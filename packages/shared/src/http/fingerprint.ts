import { sha256 } from "@noble/hashes/sha2.js";

import type { JsonValue } from "../chain/values.ts";

function canonical(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      // Object keys are unique, so two keys are never equal and no tie case is needed.
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// A stable digest of a request's meaningful content, independent of object key order. A retry of the
// same operation produces the same fingerprint, so an idempotency key reused with different content
// is detected as a conflict instead of being replayed.
export function requestFingerprint(value: JsonValue): string {
  return Array.from(
    sha256(new TextEncoder().encode(canonical(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
