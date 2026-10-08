import { crc32, deflateSync } from "node:zlib";

const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const rgbColorType = 2;
const eightBitDepth = 8;

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function header(width: number, height: number): Uint8Array {
  const out = new Uint8Array(13);
  const view = new DataView(out.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  out.set([eightBitDepth, rgbColorType, 0, 0, 0], 8);
  return out;
}

function assemble(
  width: number,
  height: number,
  imageData: Uint8Array,
): Buffer {
  return Buffer.from(
    Buffer.concat([
      signature,
      chunk("IHDR", header(width, height)),
      chunk("IDAT", imageData),
      chunk("IEND", new Uint8Array()),
    ]),
  );
}

// A real, fully decodable RGB PNG with a diagonal gradient, so a decoder produces visible pixels.
export function createDecodablePng(width: number, height: number): Buffer {
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + 1 + x * 3;
      raw[offset] = (x * 255) / Math.max(1, width - 1);
      raw[offset + 1] = (y * 255) / Math.max(1, height - 1);
      raw[offset + 2] = 160;
    }
  return assemble(width, height, deflateSync(raw));
}

// Passes structural validation (signature, header, chunk framing) but its pixel stream is garbage,
// so only a real decoder can tell it is broken.
export function createUndecodablePng(width: number, height: number): Buffer {
  return assemble(width, height, Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8));
}
