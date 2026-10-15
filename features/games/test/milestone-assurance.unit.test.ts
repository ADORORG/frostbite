import { describe, expect, it } from "vitest";

import { presentMilestone } from "../src/domain/milestone-state.ts";
import { milestoneCopy } from "../src/ui/game-player.tsx";
import { replayCheckable } from "../src/ui/milestone-list.tsx";

const milestone = { id: "first-win", title: "First win" };
const at = "2026-10-12T09:30:00.000Z";

describe("how an earned milestone is known", () => {
  it("is the game's report unless the platform replayed a run", () => {
    for (const verification of [undefined, "self-reported"] as const) {
      const view = presentMilestone(milestone, at, { verification });
      expect(view.assurance).toBe("reported");
      expect(view.detail).toBe(
        "Reported by the game on 2026-10-12. It cannot be minted yet.",
      );
    }
  });

  it("is replay-checked when the account holds the replay-verified level, said with what that shows and what it does not", () => {
    const view = presentMilestone(milestone, at, {
      verification: "replay-verified",
    });
    expect(view.assurance).toBe("replay-checked");
    expect(view.detail).toBe(
      "Replay-checked on 2026-10-12: the platform replayed the run under the game's published rules, which shows the run followed them, not that a person played it. It cannot be minted yet.",
    );
  });

  it("says nothing about assurance for a milestone not earned, whatever level a record carries", () => {
    expect(
      presentMilestone(milestone, undefined, {
        verification: "replay-verified",
      }).assurance,
    ).toBeUndefined();
  });

  it("never calls a milestone verified, claimed or minted", () => {
    const text = JSON.stringify([
      presentMilestone(milestone, at, { verification: "replay-verified" }),
      presentMilestone(milestone, at),
      milestoneCopy([]),
      replayCheckable,
    ]).toLowerCase();
    expect(text).not.toMatch(/\bverified\b|\bclaimed\b|minted\b(?! yet)/u);
  });
});

describe("what the dock says about how milestones are known", () => {
  const plain = {
    claimPolicy: "once",
    criteria: "",
    description: "",
    id: "a",
    title: "A",
  } as const;

  it("says the game reports them, for a game that declared none replay-verifiable", () => {
    expect(milestoneCopy([plain])).toContain("The game reports these itself");
    expect(milestoneCopy([plain])).not.toContain("replay-checked");
  });

  it("says some can be replay-checked, when the game declared any", () => {
    const copy = milestoneCopy([
      plain,
      { ...plain, id: "b", verification: "replay-verified" },
    ]);
    expect(copy).toContain("Some of these can be replay-checked");
    expect(copy).toContain("when you are signed in");
  });
});
