import type { JsonValue } from "@ador/game-sdk/protocol";

// A quest is long (half an hour of play can hold thousands of presses), so its presses are written compactly: one input, `keys`, holds
// up to `mostKeys` changes as a string. Each change is the ticks since the change before it (or since the quest began), in decimal, then
// one letter naming the control: a capital for a press, a small letter for a let-go. "12R30r0J" is right pressed on tick 12, let go on
// tick 42, and jump pressed on tick 42 too.
export const letters = {
  a: "act",
  b: "berry",
  c: "charm",
  d: "down",
  e: "evade",
  f: "fire",
  g: "pineapple",
  j: "jump",
  k: "skip",
  l: "left",
  m: "mushroom",
  q: "quick",
  r: "right",
  u: "up",
  v: "show1",
  w: "show2",
  x: "show3",
  y: "show4",
  z: "show5",
} as const;
export type QuestControl = (typeof letters)[keyof typeof letters];

export const mostKeys = 64;
// A gap is at most six digits, which is longer than any quest.
const longestGap = 6;

export interface KeyChange {
  readonly control: QuestControl;
  readonly gap: number;
  readonly on: boolean;
}

const byLetter: ReadonlyMap<string, QuestControl> = new Map(
  Object.entries(letters),
);

export const controlNamed = (name: string): QuestControl | undefined =>
  [...byLetter.values()].find((control) => control === name);

// The letter a change is written with, or undefined for a name that is no control of the quest's.
export function letterOf(name: string, on: boolean): string | undefined {
  const found = [...byLetter].find(([, control]) => control === name);
  if (found === undefined) return undefined;
  return on ? found[0].toUpperCase() : found[0];
}

const malformed = "keys must be ticks and letters, like 12R30r";

// The changes a `keys` input holds, or why it holds none.
export function readKeys(
  keys: JsonValue | undefined,
): readonly KeyChange[] | string {
  if (typeof keys !== "string" || keys.length === 0) return malformed;
  const entry = new RegExp(`(\\d{1,${String(longestGap)}})([A-Za-z])`, "y");
  const changes: KeyChange[] = [];
  while (entry.lastIndex < keys.length) {
    const found = entry.exec(keys);
    if (found === null) return malformed;
    const [, digits = "", letter = ""] = found;
    const control = byLetter.get(letter.toLowerCase());
    if (control === undefined) return `no control is written ${letter}`;
    if (changes.length >= mostKeys)
      return `one input holds at most ${String(mostKeys)} changes`;
    changes.push({
      control,
      gap: Number(digits),
      on: letter !== letter.toLowerCase(),
    });
  }
  return changes;
}
