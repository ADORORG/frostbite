import { crc32 } from "node:zlib";

import sharp from "sharp";

// Deterministic pseudo-noise so images do not compress to nothing.
function pixels(width: number, height: number, channels: 3 | 4): Buffer {
  const data = Buffer.alloc(width * height * channels);
  for (let index = 0; index < data.length; index += 1)
    data[index] = (index * 31 + (index >> 3) * 17) & 0xff;
  return data;
}

export type Format = "png" | "jpeg" | "webp";

export async function makeImage(options: {
  readonly alpha?: boolean;
  readonly format: Format;
  readonly height: number;
  readonly lossless?: boolean;
  readonly orientation?: number;
  readonly width: number;
}): Promise<Buffer> {
  const channels = options.alpha === true ? 4 : 3;
  let image = sharp(pixels(options.width, options.height, channels), {
    raw: { channels, height: options.height, width: options.width },
  });
  if (options.orientation !== undefined)
    image = image.withMetadata({ orientation: options.orientation });
  if (options.format === "png") return image.png().toBuffer();
  if (options.format === "jpeg") return image.jpeg({ quality: 85 }).toBuffer();
  return image.webp({ lossless: options.lossless === true }).toBuffer();
}

export function pngChunks(png: Uint8Array): { type: string; data: Buffer }[] {
  const view = Buffer.from(png);
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = 8; offset < view.length;) {
    const length = view.readUInt32BE(offset);
    chunks.push({
      data: view.subarray(offset + 8, offset + 8 + length),
      type: view.subarray(offset + 4, offset + 8).toString("latin1"),
    });
    offset += 12 + length;
  }
  return chunks;
}

// Rebuilds a PNG from chunks with fresh, correct CRCs, so the container stays well formed while
// its pixel data or header can be tampered with.
export function buildPng(chunks: { type: string; data: Buffer }[]): Buffer {
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  for (const { type, data } of chunks) {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    parts.push(length, body, crc);
  }
  return Buffer.concat(parts);
}
