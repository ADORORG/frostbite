import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MilestoneList, replayCheckable } from "../src/ui/milestone-list.tsx";

const milestones = [
  {
    claimPolicy: "once",
    criteria: "Win a board.",
    description: "Won.",
    id: "first-win",
    title: "First win",
    verification: "replay-verified",
  },
  {
    claimPolicy: "once",
    criteria: "Cash out.",
    description: "Cashed out.",
    id: "first-cashout",
    title: "First cash-out",
  },
] as const;
const unlockedAt = "2026-10-05T00:00:00.000Z";
const progress = {
  counts: { "first-cashout": 1, "first-win": 1 },
  levels: {
    "first-cashout": "self-reported",
    "first-win": "replay-verified",
  },
  totals: {},
} as const;
const markup = (unlocked: Record<string, string> | null) =>
  renderToStaticMarkup(
    <MilestoneList
      milestones={milestones}
      progress={progress}
      unlocked={unlocked}
    />,
  );

describe("the milestones of a game, by how they are known", () => {
  it("says, before play, that only the milestone the game declared replay-verifiable can be replay-checked", () => {
    const html = markup(null);
    expect(html.split(replayCheckable)).toHaveLength(2);
    expect(html).not.toContain("Replay-checked<");
  });

  it("badges the earned milestone the account holds as replay-verified, and not the one that was only reported", () => {
    const html = markup({
      "first-cashout": unlockedAt,
      "first-win": unlockedAt,
    });
    expect(html.match(/Replay-checked</gu)).toHaveLength(1);
    const checked = html.slice(
      html.indexOf('data-milestone="first-win"'),
      html.indexOf('data-milestone="first-cashout"'),
    );
    expect(checked).toContain("Replay-checked<");
    expect(checked).not.toContain(replayCheckable);
    const reported = html.slice(html.indexOf('data-milestone="first-cashout"'));
    expect(reported).toContain("Reported by the game on 2026-10-05");
    expect(reported).not.toContain("Replay-checked<");
  });

  it("keeps the replay-checkable note on a declared milestone that is earned but only reported", () => {
    const html = renderToStaticMarkup(
      <MilestoneList
        milestones={milestones}
        progress={{ ...progress, levels: { "first-win": "self-reported" } }}
        unlocked={{ "first-win": unlockedAt }}
      />,
    );
    expect(html).toContain(replayCheckable);
    expect(html).toContain("Reported by the game on 2026-10-05");
  });
});
