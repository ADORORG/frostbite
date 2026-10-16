import type { JsonValue } from "@ador/shared/chain";

import { NodeUnavailableError } from "./errors.ts";

// Narrowing for answers from a node. A node is outside the platform, so each value is checked where it is read and a wrong shape
// is reported as the node being unreliable, never passed on.
export type JsonRecord = { readonly [key: string]: JsonValue };

export function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordOf(value: JsonValue, what: string): JsonRecord {
  if (!isRecord(value))
    throw new NodeUnavailableError(`The node's ${what} is not an object.`);
  return value;
}

export function textOf(value: JsonValue | undefined, what: string): string {
  if (typeof value !== "string")
    throw new NodeUnavailableError(`The node's ${what} is not text.`);
  return value;
}

export function wholeNumberOf(
  value: JsonValue | undefined,
  what: string,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new NodeUnavailableError(`The node's ${what} is not a whole number.`);
  }
  return value;
}

export function listOf(value: JsonValue, what: string): readonly JsonValue[] {
  if (!Array.isArray(value))
    throw new NodeUnavailableError(`The node's ${what} is not a list.`);
  return value;
}
