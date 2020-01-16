import * as tlv from '../util/tlv';
import createDebug from "debug";
import {Service} from "../Service";
import {
    Characteristic,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback
} from "../Characteristic";
import {CharacteristicValue} from "../../types";
import {DataStreamTransportManagement} from "../gen/HomeKit-DataStream";
import {DataStreamServer, DataStreamServerEventMap, GlobalEventHandler, GlobalRequestHandler} from "./DataStreamServer";
import {Session} from "../util/eventedhttp";
import {Event} from "../EventEmitter";

const debug = createDebug('DataStream:Management');

export enum TransferTransportConfigurationTypes {
    TRANSFER_TRANSPORT_CONFIGURATION = 1,
}

export enum TransportTypeTypes {
    TRANSPORT_TYPE = 1,
}


export enum SetupDataStreamSessionTypes {
    SESSION_COMMAND_TYPE = 1,
    TRANSPORT_TYPE = 2,
    CONTROLLER_KEY_SALT = 3,
}

export enum SetupDataStreamWriteResponseTypes {
    STATUS = 1,
    TRANSPORT_TYPE_SESSION_PARAMETERS = 2,
    ACCESSORY_KEY_SALT = 3,
}

export enum TransportSessionConfiguration {
    TCP_LISTENING_PORT = 1,
}


export enum TransportType {
    HOMEKIT_DATA_STREAM = 0,
}

export enum SessionCommandType {
    START_SESSION = 0,
}

export enum DataStreamStatus {
    SUCCESS = 0,
    GENERIC_ERROR = 1,
    BUSY = 2, // maximum numbers of sessions
}


export class DataStreamManagement {

    // one server per accessory is probably the best practice
    private readonly dataStreamServer: DataStreamServer = new DataStreamServer();

    dataStreamTransportManagementService: DataStreamTransportManagement;

    supportedDataStreamTransportConfiguration: string;
    lastSetupDataStreamTransportResponse: string = ""; // stripped. excludes ACCESSORY_KEY_SALT

    constructor() {
        const supportedConfiguration: TransportType[] = [TransportType.HOMEKIT_DATA_STREAM];
        this.supportedDataStreamTransportConfiguration = this.buildSupportedDataStreamTransportConfigurationTLV(supportedConfiguration);


        this.dataStreamTransportManagementService = this.setupService();
    }

    /**
     * @returns the DataStreamTransportManagement service
     */
    getService(): DataStreamTransportManagement {
        return this.dataStreamTransportManagementService;
    }

    /**
     * Registers a new event handler to handle incoming event messages.
     * The handler is only called for a connection if for the give protocol no ProtocolHandler
     * was registered on the connection level.
     *
     * @param protocol {string | Protocols} - name of the protocol to register the handler for
     * @param event {string | Topics} - name of the event (also referred to as topic. See {Topics} for some known ones)
     * @param handler {GlobalEventHandler} - function to be called for every occurring event
     */
    onEventMessage(protocol: string, event: string, handler: GlobalEventHandler): this {
        this.dataStreamServer.onEventMessage(protocol, event, handler);
        return this;
    }

    /**
     * Removes an registered event handler.
     *
     * @param protocol {string | Protocols} - name of the protocol to unregister the handler for
     * @param event {string | Topics} - name of the event (also referred to as topic. See {Topics} for some known ones)
     * @param handler {GlobalEventHandler} - registered event handler
     */
    removeEventHandler(protocol: string, event: string, handler: GlobalEventHandler): this {
        this.dataStreamServer.removeEventHandler(protocol, event, handler);
        return this;
    }

    /**
     * Registers a new request handler to handle incoming request messages.
     * The handler is only called for a connection if for the give protocol no ProtocolHandler
     * was registered on the connection level.
     *
     * @param protocol {string | Protocols} - name of the protocol to register the handler for
     * @param request {string | Topics} - name of the request (also referred to as topic. See {Topics} for some known ones)
     * @param handler {GlobalRequestHandler} - function to be called for every occurring request
     */
    onRequestMessage(protocol: string, request: string, handler: GlobalRequestHandler): this {
        this.dataStreamServer.onRequestMessage(protocol, request, handler);
        return this;
    }

    /**
     * Removes an registered request handler.
     *
     * @param protocol {string | Protocols} - name of the protocol to unregister the handler for
     * @param request {string | Topics} - name of the request (also referred to as topic. See {Topics} for some known ones)
     * @param handler {GlobalRequestHandler} - registered request handler
     */
    removeRequestHandler(protocol: string, request: string, handler: GlobalRequestHandler): this {
        this.dataStreamServer.removeRequestHandler(protocol, request, handler);
        return this;
    }

    /**
     * Forwards any event listener for an DataStreamServer event to the DataStreamServer instance
     *
     * @param event - the event to register for
     * @param listener - the event handler
     */
    onServerEvent(event: Event<keyof DataStreamServerEventMap>, listener: DataStreamServerEventMap[Event<keyof DataStreamServerEventMap>]): this {
        this.dataStreamServer.on(event, listener);
        return this;
    }

    private handleSetupDataStreamTransportWrite(value: any, callback: CharacteristicSetCallback, connectionID?: string) {
        const data = Buffer.from(value, 'base64');
        const objects = tlv.decode(data);

        const sessionCommandType = objects[SetupDataStreamSessionTypes.SESSION_COMMAND_TYPE][0];
        const transportType = objects[SetupDataStreamSessionTypes.TRANSPORT_TYPE][0];
        const controllerKeySalt = objects[SetupDataStreamSessionTypes.CONTROLLER_KEY_SALT];

        debug("Received setup write with command %s and transport type %s", SessionCommandType[sessionCommandType], TransportType[transportType]);

        if (sessionCommandType === SessionCommandType.START_SESSION) {
            if (transportType !== TransportType.HOMEKIT_DATA_STREAM) {
                callback(null, DataStreamManagement.buildSetupStatusResponse(DataStreamStatus.GENERIC_ERROR));
                return;
            }

            if (!connectionID) { // we need the session for the shared secret to generate the encryption keys
                callback(null, DataStreamManagement.buildSetupStatusResponse(DataStreamStatus.GENERIC_ERROR));
                return;
            }

            const session: Session = Session.getSession(connectionID);
            if (!session) { // we need the session for the shared secret to generate the encryption keys
                callback(null, DataStreamManagement.buildSetupStatusResponse(DataStreamStatus.GENERIC_ERROR));
                return;
            }

            this.dataStreamServer.prepareSession(session, controllerKeySalt, preparedSession => {
                const listeningPort = tlv.encode(TransportSessionConfiguration.TCP_LISTENING_PORT, tlv.writeUInt16(preparedSession.port!));

                let response: Buffer = Buffer.concat([
                    tlv.encode(SetupDataStreamWriteResponseTypes.STATUS, DataStreamStatus.SUCCESS),
                    tlv.encode(SetupDataStreamWriteResponseTypes.TRANSPORT_TYPE_SESSION_PARAMETERS, listeningPort)
                ]);
                this.lastSetupDataStreamTransportResponse = response.toString('base64'); // save last response without accessory key salt

                response = Buffer.concat([
                    response,
                    tlv.encode(SetupDataStreamWriteResponseTypes.ACCESSORY_KEY_SALT, preparedSession.accessoryKeySalt)
                ]);
                callback(null, response.toString('base64'));
            });
        } else {
            callback(null, DataStreamManagement.buildSetupStatusResponse(DataStreamStatus.GENERIC_ERROR));
            return;
        }
    }

    private static buildSetupStatusResponse(status: DataStreamStatus) {
        return tlv.encode(SetupDataStreamWriteResponseTypes.STATUS, status).toString('base64');
    }

    private buildSupportedDataStreamTransportConfigurationTLV(supportedConfiguration: TransportType[]): string {
        const buffers: Buffer[] = [];
        supportedConfiguration.forEach(type => {
           const transportType = tlv.encode(TransportTypeTypes.TRANSPORT_TYPE, type);
           const transferTransportConfiguration = tlv.encode(TransferTransportConfigurationTypes.TRANSFER_TRANSPORT_CONFIGURATION, transportType);

           buffers.push(transferTransportConfiguration);
        });

        return Buffer.concat(buffers).toString('base64');
    }

    private setupService(): DataStreamTransportManagement {
        const dataStreamTransportManagement = new Service.DataStreamTransportManagement('', '');
        dataStreamTransportManagement.getCharacteristic(Characteristic.SupportedDataStreamTransportConfiguration)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, this.supportedDataStreamTransportConfiguration);
            }).getValue();
        dataStreamTransportManagement.getCharacteristic(Characteristic.SetupDataStreamTransport)!
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(null, this.lastSetupDataStreamTransportResponse);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback, context?: any, connectionID?: string) => {
                this.handleSetupDataStreamTransportWrite(value, callback, connectionID);
            }).getValue();
        dataStreamTransportManagement.setCharacteristic(Characteristic.Version, DataStreamServer.version);

        return dataStreamTransportManagement;
    }

}
