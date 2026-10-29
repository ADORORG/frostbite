import type { JsonValue } from "./protocol.ts";
import type { Stepped } from "./run-record.ts";

// The small pieces every game's rules need to check an input before they act on it. An input is untrusted (it comes from a record a
// player's browser made), so each check says plainly why it refused and never throws.
export const refuse = (reason: string): { ok: false; reason: string } => ({
  ok: false,
  reason,
});

const isObject = (
  data: JsonValue | undefined,
): data is Readonly<Record<string, JsonValue>> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

// The fields of an input's data, which must be an object with exactly the named keys; or why it is not.
export function fieldsOf(
  data: JsonValue | undefined,
  names: readonly string[],
): Readonly<Record<string, JsonValue>> | string {
  if (!isObject(data)) return "the input takes an object";
  const keys = Object.keys(data);
  return keys.length === names.length && names.every((n) => keys.includes(n))
    ? data
    : names.length === 0
      ? "the input takes no fields"
      : `the input takes exactly: ${names.join(", ")}`;
}

// A tick named by an input: a whole number from where the run is now to `last`; or why it is not.
export function tickNamed(
  value: JsonValue | undefined,
  now: number,
  last: number,
): number | string {
  if (typeof value !== "number" || !Number.isInteger(value))
    return "tick must be a whole number";
  if (value < 0 || value > last)
    return `tick must be from 0 to ${String(last)}`;
  return value < now ? `tick ${String(value)} is already past` : value;
}

// Runs `act` on an input's fields once they are checked, so a rule reads as what it does.
export function withFields<State>(
  data: JsonValue | undefined,
  names: readonly string[],
  act: (fields: Readonly<Record<string, JsonValue>>) => Stepped<State>,
): Stepped<State> {
  const fields = fieldsOf(data, names);
  return typeof fields === "string" ? refuse(fields) : act(fields);
}
