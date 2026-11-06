import { defineOutcomes, type OutcomeEntry } from "../http/outcomes.ts";
import type { UploadContentType } from "./contracts.ts";

// What can go wrong when an image is sent, in the same shape as the catalogue for accounts (`../accounts/outcomes.ts`): the server builds
// each failure from it (the reason travels in the error envelope), and the page chooses its words by the reason, never by the message, so
// a conflict for one cause is not described as a conflict for another. What the server says about the file itself once it has looked at
// its bytes is a different thing, an asset's rejection reason, and has its own words in the uploads feature.
export const uploadOutcomes = {
  // Starting an upload.
  "upload-limit-reached": {
    http: "conflict",
    message:
      "The upload could not be started. You may have reached the limit of active uploads; wait for the current ones to finish, then try again.",
  },
  "file-over-limit": {
    http: "invalid_request",
    message: "The file is larger than allowed for this use.",
  },
  // Finishing one.
  "upload-not-found": {
    http: "not_found",
    message: "The upload could not be found. Choose the file again.",
  },
  "file-not-arrived": {
    http: "conflict",
    message:
      "The file has not reached the platform yet. Wait a moment, then try again.",
  },
  "file-not-the-one-sent": {
    http: "invalid_request",
    message:
      "The file that arrived is not the one that was announced. Choose the file again.",
  },
} as const satisfies Record<string, OutcomeEntry>;

export type UploadOutcome = keyof typeof uploadOutcomes;

const outcomes = defineOutcomes(uploadOutcomes);

// A reason a server sent, if it is one of these.
export const isUploadOutcome = outcomes.isOutcome;
export const uploadOutcomeMessage = outcomes.messageOf;

// How each kind of image that may be uploaded is named for people, in the order they are listed. Keyed by the accepted types, so a type
// added to the list without a name does not compile.
const formatNames: Readonly<Record<UploadContentType, string>> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
};

// The accepted formats as a sentence needs them: "PNG, JPEG, or WebP" to offer a choice, "PNG, JPEG, and WebP" to say what is allowed.
export function describeUploadFormats(conjunction: "and" | "or"): string {
  return new Intl.ListFormat("en", {
    style: "long",
    type: conjunction === "or" ? "disjunction" : "conjunction",
  }).format(Object.values(formatNames));
}
