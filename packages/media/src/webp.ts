import { animated, malformed, type FormatParseResult } from "./contracts.ts";
import { ascii } from "./signature.ts";

const riffHeaderLength = 12;
const chunkHeaderLength = 8;
const animationFlag = 0x02;
const imageChunks = new Set(["VP8 ", "VP8L"]);
const animationChunks = new Set(["ANIM", "ANMF"]);

interface Dimensions {
  readonly height: number;
  readonly width: number;
}

function lossy(view: DataView, start: number, size: number) {
  if (size < 10) return null;
  const isKeyFrame = (view.getUint8(start) & 0x01) === 0;
  const startCode =
    view.getUint8(start + 3) === 0x9d &&
    view.getUint8(start + 4) === 0x01 &&
    view.getUint8(start + 5) === 0x2a;
  if (!isKeyFrame || !startCode) return null;
  return {
    height: view.getUint16(start + 8, true) & 0x3fff,
    width: view.getUint16(start + 6, true) & 0x3fff,
  };
}

function lossless(view: DataView, start: number, size: number) {
  if (size < 5 || view.getUint8(start) !== 0x2f) return null;
  const bits = view.getUint32(start + 1, true);
  return { height: 1 + ((bits >>> 14) & 0x3fff), width: 1 + (bits & 0x3fff) };
}

function extendedCanvas(view: DataView, start: number, size: number) {
  if (size < 10) return null;
  const read = (at: number) =>
    view.getUint8(at) |
    (view.getUint8(at + 1) << 8) |
    (view.getUint8(at + 2) << 16);
  return { height: 1 + read(start + 7), width: 1 + read(start + 4) };
}

// RIFF size must equal the file length and chunks must tile it exactly. Animation is rejected, and
// an extended canvas must agree with the single coded image so declared dimensions are not forged.
export function parseWebp(bytes: Uint8Array): FormatParseResult {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return malformed;
  let offset = riffHeaderLength;
  let canvas: Dimensions | null = null;
  let image: Dimensions | null = null;
  let index = 0;
  while (offset < bytes.length) {
    if (offset + chunkHeaderLength > bytes.length) return malformed;
    const type = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const start = offset + chunkHeaderLength;
    const next = start + size + (size & 1);
    if (next > bytes.length) return malformed;
    if (animationChunks.has(type)) return animated;
    if (index === 0 && type !== "VP8X" && !imageChunks.has(type))
      return malformed;
    if (type === "VP8X") {
      if (index !== 0) return malformed;
      canvas = extendedCanvas(view, start, size);
      if (canvas === null) return malformed;
      if ((view.getUint8(start) & animationFlag) !== 0) return animated;
    } else if (imageChunks.has(type)) {
      if (image !== null) return malformed;
      image =
        type === "VP8 "
          ? lossy(view, start, size)
          : lossless(view, start, size);
      if (image === null) return malformed;
    }
    offset = next;
    index += 1;
  }
  if (image === null || image.width === 0 || image.height === 0)
    return malformed;
  if (
    canvas !== null &&
    (canvas.width !== image.width || canvas.height !== image.height)
  )
    return malformed;
  return { ...image, mediaType: "image/webp", ok: true };
}
