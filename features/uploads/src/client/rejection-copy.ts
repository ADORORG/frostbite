import {
  describeUploadFormats,
  uploadOutcomes,
  type AssetRejectionReason,
} from "@ador/shared/uploads";

import type { FileRejection } from "./file-checks.ts";

// The formats to choose from and the formats that are allowed, said from the one list of what is accepted.
export const formatsToChoose = describeUploadFormats("or");
const formatsAllowed = describeUploadFormats("and");

const animationNotSupported = "Animated images are not supported.";

// What a file picker says about what it takes: the formats, the size limit (already written as people read it), and that an image that moves
// is not one of them.
export const describeUploadHint = (limit: string): string =>
  `${formatsToChoose}, up to ${limit}. ${animationNotSupported}`;

// Plain-language explanations for every server-side outcome. Keyed by the exhaustive reason union,
// so adding a reason without copy is a compile error. None of these echo parser or decoder text.
export const assetRejectionCopy: Readonly<
  Record<AssetRejectionReason, string>
> = {
  "animation-unsupported": `${animationNotSupported} Upload a still image.`,
  "byte-length-mismatch":
    "The uploaded file did not match its declared size. Upload it again.",
  "content-changed": "The file changed after it was uploaded. Upload it again.",
  "decode-failed":
    "The image could not be read. It may be damaged; try exporting it again.",
  "decoded-size-mismatch":
    "The image dimensions did not match the file. Try exporting it again.",
  "dimensions-exceeded":
    "The image is too large in width or height. Use a smaller image.",
  malformed: `The file is not a valid image. Upload a ${formatsToChoose}.`,
  "media-type-mismatch": `The file contents do not match its type. Upload a ${formatsToChoose}.`,
  "pixels-exceeded":
    "The image has too many pixels. Use a lower-resolution image.",
  "processing-limit-exceeded":
    "The image was too heavy to process safely. Use a smaller image.",
  "size-exceeded": uploadOutcomes["file-over-limit"].message,
  "unsupported-format": `This image format is not supported. Use ${formatsToChoose}.`,
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
      return `Only ${formatsAllowed} images can be uploaded.`;
    case "too-large":
      return `The file is larger than the ${describeByteLimit(rejection.maxBytes)} limit for this use.`;
  }
}
