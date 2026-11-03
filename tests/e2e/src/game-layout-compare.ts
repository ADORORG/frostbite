import type { Box } from "./game-layout.ts";

// How the desktop guard compares what a game page measures now with what `fixtures/games-desktop-layout.json` holds.
//
// Text takes different room on different machines (fonts, hinting), so a bar that is 33px high on one is 28px on another and the text in it
// is 40px wider or narrower. Comparing to the pixel made the guard pass on the machine that recorded it and fail on CI. What it exists to
// catch is a change made for phones that MOVES a desktop part, and that moves a part by far more than a font does: the widest difference seen
// between two machines was 41px. So a part may differ by this much on each of x, y, width and height, while the set of named parts, and the
// order they come in, must be exactly the same.
export const layoutTolerancePx = 60;

export type Layouts = Readonly<Record<string, readonly Box[]>>;

const sides = ["x", "y", "w", "h"] as const;

export function layoutDifferences(found: Layouts, saved: Layouts): string[] {
  const problems: string[] = [];
  for (const key of Object.keys(saved))
    if (!(key in found)) problems.push(`${key}: no longer measured`);
  for (const [key, boxes] of Object.entries(found)) {
    const was = saved[key];
    if (was === undefined) {
      problems.push(`${key}: not in the saved layouts`);
      continue;
    }
    const names = boxes.map((box) => box.name).join(" ");
    const savedNames = was.map((box) => box.name).join(" ");
    if (names !== savedNames) {
      problems.push(
        `${key}: the named parts changed (now ${names}; saved ${savedNames})`,
      );
      continue;
    }
    boxes.forEach((box, index) => {
      const before = was[index];
      if (before === undefined) return;
      for (const side of sides) {
        const change = box[side] - before[side];
        if (Math.abs(change) > layoutTolerancePx)
          problems.push(
            `${key}: ${box.name} ${side} is ${String(box[side])}, saved ${String(before[side])} (${String(change)}px, more than ${String(layoutTolerancePx)}px)`,
          );
      }
    });
  }
  return problems;
}

function isBox(value: unknown): value is Box {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    sides.every((side) => typeof record[side] === "number")
  );
}

// The saved file is read from disk, so its shape is checked before it is used.
export function parseSavedLayouts(text: string): Layouts {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("The saved layouts are not an object.");
  const layouts: Record<string, readonly Box[]> = {};
  for (const [key, boxes] of Object.entries(parsed)) {
    if (!Array.isArray(boxes) || !boxes.every(isBox))
      throw new Error(`The saved layout of ${key} is not a list of boxes.`);
    layouts[key] = boxes;
  }
  return layouts;
}
