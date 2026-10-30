import { describe, expect, it } from "vitest";

import { speedStepUnits, topSpeedBonus } from "../src/rules/constants.ts";
import { guaranteedRocks, layRocks } from "../src/rules/course.ts";
import {
  closeCallMilestones,
  earnedBy,
  markId,
  marks,
  metres,
  milestoneIds,
  rockMilestones,
  topSpeedMark,
} from "../src/rules/milestones.ts";
import type { SnowballState } from "../src/rules/types.ts";
import { withRocks } from "./support/states.ts";

const has = (over: Partial<SnowballState>, id: string): boolean =>
  earnedBy(withRocks([], over)).includes(id);

// Each milestone, with the least that earns it: just below does not, and exactly at it does.
const table: readonly (readonly [
  string,
  (n: number) => Partial<SnowballState>,
  number,
])[] = [
  ["first-hop", (n) => ({ hops: n }), 1],
  ...rockMilestones.map(
    ([id, at]) =>
      [id, (n: number) => ({ cleared: n }), at] as [
        string,
        (n: number) => Partial<SnowballState>,
        number,
      ],
  ),
  ...marks
    .filter((mark) => mark !== topSpeedMark)
    .map(
      (mark) =>
        [markId(mark), (n: number) => ({ distance: n }), mark * 10] as [
          string,
          (n: number) => Partial<SnowballState>,
          number,
        ],
    ),
  ["full-speed", (n) => ({ distance: n }), speedStepUnits * topSpeedBonus],
  ...closeCallMilestones.map(
    ([id, at]) =>
      [id, (n: number) => ({ closeCalls: n }), at] as [
        string,
        (n: number) => Partial<SnowballState>,
        number,
      ],
  ),
];

describe("every milestone", () => {
  it.each(table)(
    "%s is earned at its threshold and not below",
    (id, make, at) => {
      expect(has(make(at - 1), id)).toBe(false);
      expect(has(make(at), id)).toBe(true);
      expect(has(make(at + 1), id)).toBe(true);
    },
  );

  it("is covered: the table holds every milestone that stands on one number", () => {
    const rest = milestoneIds.filter(
      (id) => !table.some(([named]) => named === id),
    );
    expect(rest).toEqual([
      "foot-of-the-slope",
      "tidy-run",
      "comfortable-run",
      "sharp-finish",
      "razor-finish",
    ]);
  });

  it("reaching the foot needs the run to have finished", () => {
    expect(has({ finished: false, hops: 0 }, "foot-of-the-slope")).toBe(false);
    expect(has({ finished: true }, "foot-of-the-slope")).toBe(true);
  });

  it("a tidy run needs the foot reached with no more hops than rocks", () => {
    const rocks = [1, 2, 3];
    const tidy = (finished: boolean, hops: number) =>
      earnedBy(withRocks(rocks, { finished, hops })).includes("tidy-run");
    expect(tidy(true, 3)).toBe(true);
    expect(tidy(true, 4)).toBe(false);
    expect(tidy(false, 3)).toBe(false);
  });

  it("a comfortable run needs the foot reached without a close call", () => {
    const comfortable = (finished: boolean, closeCalls: number) =>
      has({ closeCalls, finished }, "comfortable-run");
    expect(comfortable(true, 0)).toBe(true);
    expect(comfortable(true, 1)).toBe(false);
    expect(comfortable(false, 0)).toBe(false);
  });

  it("a sharp finish needs five close calls and the foot, a razor finish eight", () => {
    for (const [id, least] of [
      ["sharp-finish", 5],
      ["razor-finish", 8],
    ] as const) {
      expect(has({ closeCalls: least - 1, finished: true }, id)).toBe(false);
      expect(has({ closeCalls: least, finished: true }, id)).toBe(true);
      expect(has({ closeCalls: least, finished: false }, id)).toBe(false);
    }
  });

  it("has forty, each with its own id, and a fresh run has none", () => {
    expect(milestoneIds).toHaveLength(40);
    expect(new Set(milestoneIds).size).toBe(40);
    expect(earnedBy(withRocks([]))).toEqual([]);
  });

  it("puts the top speed at the 300 metre mark, so no second milestone is earned at that moment", () => {
    expect(topSpeedMark).toBe(300);
    expect(markId(topSpeedMark)).toBe("full-speed");
    expect(markId(325)).toBe("metres-325");
    expect(milestoneIds).not.toContain("metres-300");
  });

  it("counts whole metres, ten units to a metre", () => {
    expect(metres(withRocks([], { distance: 99 }))).toBe(9);
    expect(metres(withRocks([], { distance: 100 }))).toBe(10);
  });
});

describe("the rocks a slope is certain to have", () => {
  it("is what the layout gives at its sparsest, and no slope has fewer", () => {
    const fewest = Math.min(
      ...Array.from({ length: 3_000 }, (_, seed) => layRocks(seed).length),
    );
    expect(fewest).toBeGreaterThanOrEqual(guaranteedRocks);
    expect(guaranteedRocks).toBe(14);
  });

  it("is enough for every rock milestone, so none is out of reach on an unlucky slope", () => {
    for (const [, count] of rockMilestones)
      expect(count).toBeLessThanOrEqual(guaranteedRocks);
  });
});
