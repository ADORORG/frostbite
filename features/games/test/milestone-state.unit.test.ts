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
