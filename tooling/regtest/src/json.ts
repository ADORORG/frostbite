import type { JsonValue } from "@frostbite/shared/chain";

export type JsonObject = { readonly [key: string]: JsonValue };

// Whether a JSON value is an object (not a list, text, number, boolean or null).
export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A JSON object, or null for any other JSON value.
export function objectOf(value: JsonValue | undefined): JsonObject | null {
  return isJsonObject(value) ? value : null;
}
