import { processImage } from "../../src/process-image.ts";

export const limits = { maxDimension: 8_192, maxPixels: 40_000_000 };
export const derivatives = [
  { kind: "thumbnail", maxSide: 256 },
  { kind: "preview", maxSide: 1_024 },
] as const;

// Runs the in-process decoder against recorded dimensions, with overridable request fields.
export async function run(
  bytes: Uint8Array,
  width: number,
  height: number,
  extra = {},
) {
  return processImage({
    bytes,
    derivatives,
    expected: { height, width },
    limits,
    quality: 80,
    ...extra,
  });
}
