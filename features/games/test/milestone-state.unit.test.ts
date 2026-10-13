import { describe, expect, it } from "vitest";

import {
  milestoneStates,
  presentMilestone,
  reachedSummary,
} from "../src/domain/milestone-state.ts";

const milestone = { id: "first-five", title: "First five" };

describe("a milestone's state for a player", () => {
  it("is not earned until the game reports it", () => {
    expect(presentMilestone(milestone, undefined)).toEqual({
      detail: "Not reported by the game yet.",
      id: "first-five",
      label: "Not yet",
      state: "not-earned",
      title: "First five",
    });
  });

  it("is earned once reported, said as the game's report with the day and what it cannot do yet", () => {
    const view = presentMilestone(milestone, "2026-10-12T09:30:00.000Z");
    expect(view).toMatchObject({ label: "Reached", state: "earned" });
    expect(view.detail).toBe(
      "Reported by the game on 2026-10-12. It cannot be minted yet.",
    );
  });

  it("never claims more than is true: no verified or minted wording", () => {
    const text = JSON.stringify([
      presentMilestone(milestone, undefined),
      presentMilestone(milestone, "2026-10-12T00:00:00.000Z"),
    ]).toLowerCase();
    expect(text).not.toMatch(/verified|minted\b(?! yet)|claimed/u);
    expect(milestoneStates).toEqual(["not-earned", "earned"]);
  });

  it("counts what has been reached", () => {
    const views = [
      presentMilestone(milestone, "2026-10-12T00:00:00.000Z"),
      presentMilestone({ id: "b", title: "B" }, undefined),
      presentMilestone({ id: "c", title: "C" }, undefined),
    ];
    expect(reachedSummary(views)).toBe("1 of 3 reached");
    expect(reachedSummary([])).toBe("0 of 0 reached");
  });
});

describe("a milestone with a target or a count", () => {
  const withTarget = { ...milestone, target: 10 };
  const repeatable = { ...milestone, maxCount: 100 };

  it("says how far along it is while it is not earned, and says nothing of progress when none was reported", () => {
    expect(presentMilestone(withTarget, undefined, { total: 7 })).toMatchObject(
      {
        detail: "7 of 10 reported by the game so far.",
        label: "7 of 10",
        state: "not-earned",
      },
    );
    for (const none of [{}, { total: 0 }])
      expect(presentMilestone(withTarget, undefined, none)).toMatchObject({
        detail: "Not reported by the game yet.",
        label: "Not yet",
      });
    // A milestone with no target never shows a total, whatever is passed.
    expect(presentMilestone(milestone, undefined, { total: 7 }).label).toBe(
      "Not yet",
    );
  });

  it("says how many times a repeatable milestone was reported, up to the game's own limit", () => {
    const view = presentMilestone(repeatable, "2026-10-12T00:00:00.000Z", {
      count: 3,
    });
    expect(view).toMatchObject({ label: "Reached x3", state: "earned" });
    expect(view.detail).toBe(
      "Reported by the game on 2026-10-12. Reported 3 times (counted up to 100). It cannot be minted yet.",
    );
  });

  it("says nothing of a count for one earned once, or earned a single time", () => {
    expect(
      presentMilestone(milestone, "2026-10-12T00:00:00.000Z", { count: 4 })
        .label,
    ).toBe("Reached");
    expect(
      presentMilestone(milestone, "2026-10-12T00:00:00.000Z", { count: 4 })
        .detail,
    ).not.toContain("counted up to");
    expect(
      presentMilestone(repeatable, "2026-10-12T00:00:00.000Z", { count: 1 }),
    ).toMatchObject({ label: "Reached" });
    expect(presentMilestone(repeatable, "2026-10-12T00:00:00.000Z").label).toBe(
      "Reached",
    );
  });
});
