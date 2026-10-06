import type {
  ImageProcessor,
  ProcessImageInput,
  ProducedDerivative,
} from "@ador/media/processing";
import sharp from "sharp";

// Runs inside the isolated child. libvips decodes lazily and strictly (`failOn: "warning"`), so a
// truncated or corrupt pixel stream fails here. The decoder is told the pixel limit and the header
// must agree with the dimensions recorded by structural validation. Output is WebP, EXIF
// auto-oriented, never enlarged, and carries no source metadata (sharp strips it by default).
export const processImage: ImageProcessor["process"] = async (
  input: ProcessImageInput,
) => {
  sharp.cache(false);
  sharp.concurrency(1);
  try {
    const source = sharp(
      Buffer.from(
        input.bytes.buffer,
        input.bytes.byteOffset,
        input.bytes.byteLength,
      ),
      {
        failOn: "warning",
        limitInputPixels: input.limits.maxPixels,
        sequentialRead: true,
      },
    );
    const metadata = await source.metadata();
    if (
      metadata.width !== input.expected.width ||
      metadata.height !== input.expected.height
    )
      return { ok: false, reason: "decoded-size-mismatch" };
    const derivatives: ProducedDerivative[] = [];
    for (const request of input.derivatives) {
      const { data, info } = await source
        .clone()
        .rotate()
        .resize({
          fit: "inside",
          height: request.maxSide,
          width: request.maxSide,
          withoutEnlargement: true,
        })
        .webp({ quality: input.quality })
        .toBuffer({ resolveWithObject: true });
      derivatives.push({
        bytes: data,
        height: info.height,
        kind: request.kind,
        width: info.width,
      });
    }
    return { derivatives, ok: true };
  } catch {
    // Decoder messages describe untrusted input and are never surfaced or persisted.
    return { ok: false, reason: "decode-failed" };
  }
};
