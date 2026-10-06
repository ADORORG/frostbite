import { crc32 } from "node:zlib";

import { animated, malformed, type FormatParseResult } from "./contracts.ts";
import { ascii } from "./signature.ts";

const signatureLength = 8;
const chunkOverhead = 12;
const headerLength = 13;

// Walks every chunk, verifies each CRC, and requires one IEND with no trailing bytes, so a
// truncated, spliced, or polyglot file is rejected before any dimension is trusted.
export function parsePng(bytes: Uint8Array): FormatParseResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = signatureLength;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;
  while (offset + chunkOverhead <= bytes.length) {
    const length = view.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    const next = offset + chunkOverhead + length;
    // Any length beyond the buffer, including the format's 2^31 ceiling, overruns it here.
    if (next > bytes.length) return malformed;
    const checked = bytes.subarray(offset + 4, offset + 8 + length);
    if (crc32(checked) !== view.getUint32(offset + 8 + length))
      return malformed;
    if (!sawHeader) {
      if (type !== "IHDR" || length !== headerLength) return malformed;
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      sawHeader = true;
    } else if (type === "IHDR") return malformed;
    if (type === "acTL") return animated;
    if (type === "IDAT") sawData = true;
    if (type === "IEND") {
      const valid = length === 0 && sawData && next === bytes.length;
      return valid && width > 0 && height > 0
        ? { height, mediaType: "image/png", ok: true, width }
        : malformed;
    }
    offset = next;
  }
  return malformed;
}
