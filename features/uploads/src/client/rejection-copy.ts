import type { AssetRejectionReason } from "@ador/shared/uploads";

import type { FileRejection } from "./file-checks.ts";

// Plain-language explanations for every server-side outcome. Keyed by the exhaustive reason union,
// so adding a reason without copy is a compile error. None of these echo parser or decoder text.
export const assetRejectionCopy: Readonly<
  Record<AssetRejectionReason, string>
> = {
  "animation-unsupported":
    "Animated images are not supported. Upload a still image.",
  "byte-length-mismatch":
    "The uploaded file did not match its declared size. Upload it again.",
  "content-changed": "The file changed after it was uploaded. Upload it again.",
  "decode-failed":
    "The image could not be read. It may be damaged; try exporting it again.",
  "decoded-size-mismatch":
    "The image dimensions did not match the file. Try exporting it again.",
  "dimensions-exceeded":
    "The image is too large in width or height. Use a smaller image.",
  malformed: "The file is not a valid image. Upload a PNG, JPEG, or WebP.",
  "media-type-mismatch":
    "The file contents do not match its type. Upload a PNG, JPEG, or WebP.",
  "pixels-exceeded":
    "The image has too many pixels. Use a lower-resolution image.",
  "processing-limit-exceeded":
    "The image was too heavy to process safely. Use a smaller image.",
  "size-exceeded": "The file is larger than allowed for this use.",
  "unsupported-format":
    "This image format is not supported. Use PNG, JPEG, or WebP.",
};

const megabyte = 1_000_000;

// The one way a byte limit is written for people, so the form hint and the refusal agree.
export const describeByteLimit = (bytes: number): string =>
  `${bytes / megabyte} MB`;

export function describeFileRejection(rejection: FileRejection): string {
  switch (rejection.kind) {
    case "empty":
      return "The file is empty.";
    case "unsupported-type":
      return "Only PNG, JPEG, and WebP images can be uploaded.";
    case "too-large":
      return `The file is larger than the ${describeByteLimit(rejection.maxBytes)} limit for this use.`;
  }
}
