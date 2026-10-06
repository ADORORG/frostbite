import { crc32 } from "node:zlib";

import { concat, text } from "./files.ts";

function u32(value: number, littleEndian: boolean): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, littleEndian);
  return out;
}

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const body = concat(text(type), data);
  return concat(u32(data.length, false), body, u32(crc32(body), false));
}

export function pngHeader(width: number, height: number): Uint8Array {
  return pngChunk(
    "IHDR",
    concat(u32(width, false), u32(height, false), Uint8Array.of(8, 2, 0, 0, 0)),
  );
}

const pngSignature = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
);

// Structurally valid PNG whose pixel stream is not a real zlib image; the parser validates the
// container, so this is how forged-but-well-formed headers (decompression bombs) are produced.
export function pngWithHeader(width: number, height: number): Uint8Array {
  return concat(
    pngSignature,
    pngHeader(width, height),
    pngChunk("IDAT", Uint8Array.of(0)),
    pngChunk("IEND", new Uint8Array()),
  );
}

export function pngFromChunks(...chunks: readonly Uint8Array[]): Uint8Array {
  return concat(pngSignature, ...chunks);
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value >> 8, value & 0xff);
}

export function jpegSegment(marker: number, body: Uint8Array): Uint8Array {
  return concat(Uint8Array.of(0xff, marker), u16(body.length + 2), body);
}

export function jpegFrame(width: number, height: number, marker = 0xc0) {
  const component = (id: number) => Uint8Array.of(id, 0x11, 0);
  return jpegSegment(
    marker,
    concat(
      Uint8Array.of(8),
      u16(height),
      u16(width),
      Uint8Array.of(3),
      component(1),
      component(2),
      component(3),
    ),
  );
}

export function jpegScan(): Uint8Array {
  return concat(
    jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0)),
    Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56),
  );
}

export const jpegStart = Uint8Array.of(0xff, 0xd8);
export const jpegEnd = Uint8Array.of(0xff, 0xd9);

export function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const padding = data.length % 2 === 1 ? Uint8Array.of(0) : new Uint8Array();
  return concat(text(type), u32(data.length, true), data, padding);
}

export function riff(...chunks: readonly Uint8Array[]): Uint8Array {
  const body = concat(text("WEBP"), ...chunks);
  return concat(text("RIFF"), u32(body.length, true), body);
}
