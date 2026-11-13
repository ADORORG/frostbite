import { maxKeysPerInput } from "./constants.ts";
import type { Action } from "./types.ts";

// A run's keys are written compactly: each is the ticks since the one before (nothing for none) and a letter. "12l3r0a" is left on tick
// 12, right on tick 15, turn on tick 15 again. A long run is some hundreds of these, in batches.
const letters: Readonly<Record<string, Action>> = {
  a: "turnRight",
  b: "turnLeft",
  d: "hard",
  h: "hold",
  l: "left",
  r: "right",
  s: "softOn",
  S: "softOff",
};
const letterOf = Object.fromEntries(
  Object.entries(letters).map(([letter, action]) => [action, letter]),
);

export interface Key {
  readonly action: Action;
  readonly gap: number;
}

export const encodeKey = (key: Key): string =>
  `${key.gap === 0 ? "" : String(key.gap)}${letterOf[key.action] ?? ""}`;

// The keys a text holds, or why it is not a run's keys.
export function readKeys(text: unknown): readonly Key[] | string {
  if (typeof text !== "string") return "keys must be text";
  const keys: Key[] = [];
  let gap = "";
  for (const char of text) {
    if (char >= "0" && char <= "9") {
      gap += char;
      if (gap.length > 5) return "a gap is at most five digits";
      continue;
    }
    const action = letters[char];
    if (action === undefined) return `no such key: ${char}`;
    keys.push({ action, gap: gap === "" ? 0 : Number(gap) });
    gap = "";
    if (keys.length > maxKeysPerInput)
      return `at most ${String(maxKeysPerInput)} keys in one input`;
  }
  return gap === "" ? keys : "the keys end with a gap and no key";
}
