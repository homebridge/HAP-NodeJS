import crypto from "crypto";
import {
  buildMediaPlaylist,
  buildMultivariantPlaylist,
  deriveClipKey,
  mapStatus,
  ntpToDate,
  sealSegment,
  sealSessionValue,
} from "./CMAFIngest";
import { CMAFError } from "./SecureVideoTypes";

const cameraKey = crypto.randomBytes(32);
const key = deriveClipKey(0x1234n, cameraKey);

function open(sealed: Buffer): Buffer {
  const iv = sealed.subarray(0, 16);
  const tag = sealed.subarray(sealed.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key.contentKey, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed.subarray(16, sealed.length - 16)), decipher.final()]);
}

describe("CMAFIngest", () => {
  test("derives the clip key id and content key from the camera key", () => {
    // key number in the upper bits, key type CMAF (1) at bit 14
    expect(key.keyIdString).toBe("0000000012344000");
    expect(key.contentKey).toHaveLength(32);
    expect(key.contentKey).toEqual(Buffer.from(crypto.hkdfSync("sha256", cameraKey, Buffer.alloc(0), "HomeKit 1.0 CMAF Content", 32)));
    expect(deriveClipKey(0x1234n, cameraKey).contentKey).toEqual(key.contentKey);
  });

  test("seals segments as iv, ciphertext, tag", () => {
    const plaintext = crypto.randomBytes(1000);
    const sealed = sealSegment(key, plaintext);
    expect(sealed).toHaveLength(plaintext.length + 32);
    expect(open(sealed)).toEqual(plaintext);
    expect(sealSegment(key, plaintext)).not.toEqual(sealed);
  });

  test("seals session data values as base64 json", () => {
    const value = JSON.parse(Buffer.from(sealSessionValue(key, "2026-09-15T00:00:00Z"), "base64").toString("utf8"));
    expect(value.method).toBe("AES-256-GCM");
    expect(value.keyIDString).toBe(key.keyIdString);
    const sealed = Buffer.concat([
      Buffer.from(value.initializationVector, "base64"),
      Buffer.from(value.ciphertext, "base64"),
      Buffer.from(value.tag, "base64"),
    ]);
    expect(open(sealed).toString("utf8")).toBe("2026-09-15T00:00:00Z");
  });

  test("builds the multivariant playlist", () => {
    const sensor = "6d3b7b46-8a7d-4a8f-9c5a-1f7e0f0c0b1a";
    const playlist = buildMultivariantPlaylist(key, new Date("2026-09-15T00:00:00.000Z"), sensor, {
      codecs: "hvc1.1.6.L120.B0",
      width: 1920,
      height: 1080,
      bitrate: 1700000,
    });
    const lines = playlist.split("\n");
    expect(lines[0]).toBe("#EXTM3U");
    expect(lines).toContain(`#EXT-X-SESSION-KEY:METHOD=AES-256-GCM,URI="${key.keyIdString}"`);
    expect(lines).toContain(`#EXT-X-SESSION-DATA:DATA-ID="com.apple.homekit.sensor-id",VALUE="${sensor}"`);
    expect(lines).toContain("#EXT-X-STREAM-INF:BANDWIDTH=1700000,CODECS=\"hvc1.1.6.L120.B0\",RESOLUTION=1920x1080");
    expect(lines[lines.indexOf("#EXT-X-STREAM-INF:BANDWIDTH=1700000,CODECS=\"hvc1.1.6.L120.B0\",RESOLUTION=1920x1080") + 1]).toBe("video/index.m3u8");

    const timestamp = lines.find(line => line.includes("com.apple.encrypted-datetime.timestamp"))!;
    const value = JSON.parse(Buffer.from(/VALUE="([^"]+)"/.exec(timestamp)![1], "base64").toString("utf8"));
    const sealed = Buffer.concat([
      Buffer.from(value.initializationVector, "base64"),
      Buffer.from(value.ciphertext, "base64"),
      Buffer.from(value.tag, "base64"),
    ]);
    expect(open(sealed).toString("utf8")).toBe("2026-09-15T00:00:00Z");
  });

  test("builds the media playlist from the segment durations", () => {
    const initial = buildMediaPlaylist(key, [], false).split("\n");
    expect(initial).toContain("#EXT-X-TARGETDURATION:2");
    expect(initial).toContain("#EXT-X-MEDIA-SEQUENCE:1001");
    expect(initial).toContain("#EXT-X-MAP:URI=\"video.init\"");
    expect(initial).toContain(`#EXT-X-KEY:METHOD=AES-256-GCM,URI="${key.keyIdString}"`);
    expect(initial.some(line => line.startsWith("#EXTINF"))).toBe(false);
    expect(initial).not.toContain("#EXT-X-ENDLIST");

    const ended = buildMediaPlaylist(key, [4, 4.5], true).split("\n");
    expect(ended).toContain("#EXT-X-TARGETDURATION:5");
    expect(ended.slice(ended.indexOf("#EXTINF:4.000,"))).toEqual([
      "#EXTINF:4.000,",
      "segment_1001.m4s",
      "#EXTINF:4.500,",
      "segment_1002.m4s",
      "#EXT-X-ENDLIST",
      "",
    ]);
  });

  test("maps http statuses to cmaf errors", () => {
    expect(mapStatus(400)).toBe(CMAFError.HTTP_BAD_REQUEST);
    expect(mapStatus(401)).toBe(CMAFError.HTTP_INVALID_TOKEN);
    expect(mapStatus(403)).toBe(CMAFError.HTTP_INVALID_TOKEN);
    expect(mapStatus(404)).toBe(CMAFError.HTTP_NOT_FOUND);
    expect(mapStatus(412)).toBe(CMAFError.HTTP_INIT_MISSING);
    expect(mapStatus(415)).toBe(CMAFError.HTTP_UNSUPPORTED_MEDIA_TYPE);
    expect(mapStatus(503)).toBe(CMAFError.HTTP_SERVICE_UNAVAILABLE);
    expect(mapStatus(500)).toBe(CMAFError.HTTP_INTERNAL_SERVER_ERROR);
    expect(mapStatus(418)).toBe(CMAFError.UNKNOWN);
  });

  test("converts ntp timestamps", () => {
    const unixSeconds = Math.floor(Date.UTC(2026, 8, 14, 14, 54, 44) / 1000);
    const ntp = (BigInt(unixSeconds) + 2_208_988_800n) << 32n;
    expect(ntpToDate(ntp).toISOString()).toBe("2026-09-14T14:54:44.000Z");
    expect(Math.abs(ntpToDate(undefined).getTime() - Date.now())).toBeLessThan(1000);
    expect(Math.abs(ntpToDate(5n).getTime() - Date.now())).toBeLessThan(1000);
  });
});
