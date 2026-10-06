import { malformed, type FormatParseResult } from "./contracts.ts";

const markerPrefix = 0xff;
const startOfImage = 0xd8;
const endOfImage = 0xd9;
const startOfScan = 0xda;
// Baseline, extended sequential, and progressive Huffman: the only frame types accepted.
const supportedFrames = new Set([0xc0, 0xc1, 0xc2]);
const otherFrames = new Set([
  0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const unsupported: FormatParseResult = {
  ok: false,
  reason: "unsupported-format",
};

function isRestart(marker: number): boolean {
  return marker >= 0xd0 && marker <= 0xd7;
}

// Index of the first marker prefix that is not stuffing or a restart inside entropy data.
function skipScanData(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    if (bytes[offset] !== markerPrefix) offset += 1;
    else {
      const next = bytes[offset + 1];
      if (next === undefined) return bytes.length;
      if (next === 0x00 || isRestart(next)) offset += 2;
      else if (next === markerPrefix) offset += 1;
      else return offset;
    }
  }
  return offset;
}

// Walks every marker segment and requires a frame, a scan, and a final EOI with no trailing bytes.
export function parseJpeg(bytes: Uint8Array): FormatParseResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  let frame: { height: number; width: number } | undefined;
  let scans = 0;
  while (offset < bytes.length) {
    if (bytes[offset] !== markerPrefix) return malformed;
    while (bytes[offset] === markerPrefix) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    // SOI is only valid at the start, which the signature already proved.
    if (marker === undefined || marker === 0x00 || marker === startOfImage)
      return malformed;
    if (marker === endOfImage) {
      return frame !== undefined && scans > 0 && offset === bytes.length
        ? { ...frame, mediaType: "image/jpeg", ok: true }
        : malformed;
    }
    if (marker === 0x01 || isRestart(marker)) continue;
    if (offset + 2 > bytes.length) return malformed;
    const length = view.getUint16(offset);
    // A length that runs past the buffer simply ends the walk below, which is malformed.
    if (length < 2) return malformed;
    if (otherFrames.has(marker)) return unsupported;
    if (supportedFrames.has(marker)) {
      const components = bytes[offset + 7] ?? 0;
      // A non-zero component count proves the header bytes below are inside the buffer.
      if (frame !== undefined || components === 0) return malformed;
      if (length !== 8 + 3 * components) return malformed;
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);
      if (height === 0 || width === 0) return malformed;
      frame = { height, width };
    }
    offset += length;
    if (marker === startOfScan) {
      if (frame === undefined) return malformed;
      scans += 1;
      offset = skipScanData(bytes, offset);
    }
  }
  return malformed;
}
