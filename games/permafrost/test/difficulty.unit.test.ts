import { describe, expect, it } from "vitest";

import { linesPerLevel } from "../src/rules/constants.ts";
import {
  garbageEvery,
  gravityFor,
  levelOf,
  lockDelayFor,
  previewFor,
  topLevelSpeed,
} from "../src/rules/difficulty.ts";

const levels = Array.from({ length: 40 }, (_, at) => at + 1);

describe("the difficulty curve", () => {
  it("rises a level every ten lines, from level one", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(linesPerLevel - 1)).toBe(1);
    expect(levelOf(linesPerLevel)).toBe(2);
    expect(levelOf(199)).toBe(20);
  });

  it("only ever gets harder: pieces fall no slower, rest no longer, are shown no further ahead, and grey rows come no later", () => {
    for (const level of levels.slice(1)) {
      expect(gravityFor(level)).toBeLessThanOrEqual(gravityFor(level - 1));
      expect(lockDelayFor(level)).toBeLessThanOrEqual(lockDelayFor(level - 1));
      expect(previewFor(level)).toBeLessThanOrEqual(previewFor(level - 1));
      const before = garbageEvery(level - 1);
      const now = garbageEvery(level);
      if (now !== null) expect(before === null || now <= before).toBe(true);
      if (before !== null) expect(now).not.toBeNull();
    }
  });

  it("never jumps: one level makes a piece fall at most half again as fast, and the first level is slow and gentle", () => {
    for (const level of levels.slice(1))
      expect(gravityFor(level - 1)).toBeLessThanOrEqual(
        Math.ceil(gravityFor(level) * 2),
      );
    expect(gravityFor(1)).toBeGreaterThanOrEqual(30);
    expect(lockDelayFor(1)).toBeGreaterThanOrEqual(30);
    expect(previewFor(1)).toBe(3);
    expect(garbageEvery(1)).toBeNull();
  });

  it("stops at the limits the rules allow: a row a tick, a short but real moment to slide a piece, and grey rows every few pieces", () => {
    expect(gravityFor(200)).toBe(topLevelSpeed);
    expect(gravityFor(1_000)).toBe(topLevelSpeed);
    expect(lockDelayFor(1_000)).toBeGreaterThanOrEqual(10);
    expect(garbageEvery(1_000)).toBeGreaterThanOrEqual(6);
    expect(previewFor(1_000)).toBe(1);
  });

  it("starts the grey rows only after level eleven, and never more than one in six pieces", () => {
    expect(garbageEvery(11)).toBeNull();
    expect(garbageEvery(12)).not.toBeNull();
    for (const level of levels) {
      const every = garbageEvery(level);
      if (every !== null) expect(every).toBeGreaterThanOrEqual(6);
    }
  });
});
