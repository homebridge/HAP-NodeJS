import createDebug from "debug";

import {
  DataStreamConnection,
  DataStreamManagement,
  GlobalEventHandler,
  GlobalRequestHandler,
  HDSProtocolSpecificErrorReason,
  HDSStatus,
  Protocols,
  Topics,
} from "../datastream";

import type { SnapshotRequest } from "./RTPStreamManagement";

const debug = createDebug("HAP-NodeJS:SecureVideo:Snapshot");

const CHUNK_SIZE = 0x40000;
const TIMEOUT_MS = 25000;

/**
 * Produces a JPEG snapshot for the secure video camera. The HAP image resource request passes the requested
 * size and reason, the HDS `ipcamera.snapshot` relay carries no such information and calls without a request.
 *
 * @group Camera Secure Video
 */
export type SecureVideoSnapshotHandler = (request?: SnapshotRequest) => Promise<Buffer>;

interface SnapshotTransfer {
  connection: DataStreamConnection;
  streamId: number;
  timer?: ReturnType<typeof setTimeout>;
  onClose: () => void;
  sent: boolean;
}

/**
 * Serves camera snapshots over the HDS `ipcamera.snapshot` data stream. iOS 27 fetches snapshots for the
 * secure video camera services through this relay instead of the legacy image resource request, so the
 * controller installs it on the recording data stream. The actual image is produced by the supplied handler.
 *
 * @group Camera Secure Video
 */
export class HDSSnapshotTransport {
  private readonly transfers = new Set<SnapshotTransfer>();
  private captureInFlight?: Promise<Buffer>;

  constructor(
    private readonly dataStreamManagement: DataStreamManagement,
    private readonly snapshot: SecureVideoSnapshotHandler,
    private readonly isActive: () => boolean,
  ) {
    dataStreamManagement.onRequestMessage(Protocols.DATA_SEND, Topics.OPEN, this.onOpen);
    dataStreamManagement.onEventMessage(Protocols.DATA_SEND, Topics.ACK, this.onAck);
    dataStreamManagement.onEventMessage(Protocols.DATA_SEND, Topics.CLOSE, this.onCloseEvent);
  }

  /** Removes the data stream handlers and cancels any in-flight transfers. Call when the controller is removed. */
  destroy(): void {
    this.dataStreamManagement.removeRequestHandler(Protocols.DATA_SEND, Topics.OPEN, this.onOpen);
    this.dataStreamManagement.removeEventHandler(Protocols.DATA_SEND, Topics.ACK, this.onAck);
    this.dataStreamManagement.removeEventHandler(Protocols.DATA_SEND, Topics.CLOSE, this.onCloseEvent);
    this.closeAll();
  }

  closeAll(): void {
    for (const transfer of [...this.transfers]) {
      this.finish(transfer, HDSProtocolSpecificErrorReason.CANCELLED);
    }
  }

  private readonly onOpen: GlobalRequestHandler = (connection, id, message) => {
    if (message?.type === "ipcamera.snapshot") {
      this.open(connection, id, message);
    }
  };

  private readonly onAck: GlobalEventHandler = (connection, message) => {
    const transfer = this.find(connection, message?.streamId);
    if (transfer && transfer.sent && message?.endOfStream === true) {
      this.finish(transfer);
    }
  };

  private readonly onCloseEvent: GlobalEventHandler = (connection, message) => {
    const transfer = this.find(connection, message?.streamId);
    if (transfer) {
      this.finish(transfer);
    }
  };

  private find(connection: DataStreamConnection, streamId?: number): SnapshotTransfer | undefined {
    return [...this.transfers].find(transfer => transfer.connection === connection && (streamId === undefined || transfer.streamId === streamId));
  }

  private reject(connection: DataStreamConnection, id: number, reason: HDSProtocolSpecificErrorReason): void {
    connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.PROTOCOL_SPECIFIC_ERROR, { status: reason });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private open(connection: DataStreamConnection, id: number, message: any): void {
    if (message.target !== "controller" || !Number.isSafeInteger(message.streamId) || message.streamId < 0) {
      this.reject(connection, id, HDSProtocolSpecificErrorReason.UNEXPECTED_FAILURE);
      return;
    }
    if (!this.isActive()) {
      this.reject(connection, id, HDSProtocolSpecificErrorReason.NOT_ALLOWED);
      return;
    }
    if (this.find(connection, message.streamId)) {
      this.reject(connection, id, HDSProtocolSpecificErrorReason.BUSY);
      return;
    }

    const transfer: SnapshotTransfer = { connection, streamId: message.streamId, sent: false, onClose: () => this.finish(transfer) };
    this.transfers.add(transfer);
    connection.once("closed", transfer.onClose);
    this.armTimeout(transfer);

    try {
      connection.sendResponse(Protocols.DATA_SEND, Topics.OPEN, id, HDSStatus.SUCCESS, { status: 0 });
    } catch {
      this.finish(transfer);
      return;
    }

    this.sendImage(transfer);
  }

  private captureSnapshot(): Promise<Buffer> {
    if (!this.captureInFlight) {
      this.captureInFlight = this.snapshot().finally(() => {
        this.captureInFlight = undefined;
      });
    }
    return this.captureInFlight;
  }

  private async sendImage(transfer: SnapshotTransfer): Promise<void> {
    try {
      const jpeg = await this.captureSnapshot();
      if (!this.transfers.has(transfer)) {
        return;
      }
      if (!this.isActive()) {
        this.finish(transfer, HDSProtocolSpecificErrorReason.NOT_ALLOWED);
        return;
      }
      if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
        throw new Error("snapshot is empty or not JPEG");
      }

      for (let offset = 0, sequence = 1; offset < jpeg.length; offset += CHUNK_SIZE, sequence++) {
        if (!this.transfers.has(transfer)) {
          return;
        }
        const data = jpeg.subarray(offset, offset + CHUNK_SIZE);
        const last = offset + data.length === jpeg.length;
        transfer.sent = last;
        transfer.connection.sendEvent(Protocols.DATA_SEND, Topics.DATA, {
          streamId: transfer.streamId,
          packets: [{
            data,
            metadata: {
              dataType: "image",
              dataSequenceNumber: 1,
              dataChunkSequenceNumber: sequence,
              isLastDataChunk: last,
              ...(sequence === 1 ? { dataTotalSize: jpeg.length } : {}),
            },
          }],
          endOfStream: last,
        });
        if (!last) {
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      }

      debug("sent %d bytes (stream %d)", jpeg.length, transfer.streamId);
      if (this.transfers.has(transfer)) {
        this.armTimeout(transfer);
      }
    } catch (error) {
      if (!this.transfers.has(transfer)) {
        return;
      }
      debug("snapshot failed: %s", error instanceof Error ? error.message : error);
      this.finish(transfer, HDSProtocolSpecificErrorReason.UNEXPECTED_FAILURE);
    }
  }

  private armTimeout(transfer: SnapshotTransfer): void {
    clearTimeout(transfer.timer);
    transfer.timer = setTimeout(() => this.finish(transfer, HDSProtocolSpecificErrorReason.TIMEOUT), TIMEOUT_MS);
    transfer.timer.unref?.();
  }

  private finish(transfer: SnapshotTransfer, reason?: HDSProtocolSpecificErrorReason): void {
    if (!this.transfers.delete(transfer)) {
      return;
    }
    clearTimeout(transfer.timer);
    transfer.connection.removeListener("closed", transfer.onClose);
    if (reason !== undefined) {
      try {
        transfer.connection.sendEvent(Protocols.DATA_SEND, Topics.CLOSE, { streamId: transfer.streamId, reason });
      } catch {
        // connection already gone
      }
    }
  }
}
