import type { PublicProfileView } from "@frostbite/shared/profiles";
import { describe, expect, it } from "vitest";

import { publicProfileModel } from "../src/domain/public-model.ts";
import { runner, stacker } from "./support/games.ts";

const claim = (digit: number) =>
  `5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b6${String(digit)}`;
const view: PublicProfileView = {
  avatar: "fox",
  bests: [
    {
      achievedAt: "2026-11-02T00:00:00.000Z",
      gameId: "frost-runner",
      score: 100,
    },
    { achievedAt: "2026-11-05T00:00:00.000Z", gameId: "tower-stack", score: 7 },
    {
      achievedAt: "2026-11-09T00:00:00.000Z",
      gameId: "retired-game",
      score: 999,
    },
  ],
  memberSince: "2026-10-01T00:00:00.000Z",
  mints: [
    {
      claimId: claim(1),
      gameId: "frost-runner",
      milestoneId: "first-run",
      mintedAt: "2026-11-01T00:00:00.000Z",
    },
    {
      claimId: claim(2),
      gameId: "tower-stack",
      milestoneId: "ten-high",
      mintedAt: "2026-11-04T00:00:00.000Z",
    },
    {
      claimId: claim(3),
      gameId: "tower-stack",
      milestoneId: "removed-milestone",
      mintedAt: "2026-11-03T00:00:00.000Z",
    },
    {
      claimId: claim(4),
      gameId: "retired-game",
      milestoneId: "x",
      mintedAt: "2026-11-08T00:00:00.000Z",
    },
  ],
  name: "IceAda",
};

describe("what the public profile page draws", () => {
  const model = publicProfileModel(view, [runner, stacker]);

  it("carries the name and picture, and says when the player joined", () => {
    expect(model).toMatchObject({
      avatar: "fox",
      joined: "Joined Oct 2026",
      name: "IceAda",
    });
  });

  it("lists the best scores newest first, each with its game and where to play it, and leaves out a game the platform does not list", () => {
    expect(model.bests.map(({ game, score }) => [game.id, score])).toEqual([
      ["tower-stack", 7],
      ["frost-runner", 100],
    ]);
    expect(model.bests[0]?.playHref).toBe("/games/tower-stack");
  });

  it("lists the mints newest first with the milestone's title, falls back to its id, and leaves out an unlisted game", () => {
    expect(
      model.mints.map(({ claimId, milestoneTitle }) => [
        claimId,
        milestoneTitle,
      ]),
    ).toEqual([
      [claim(2), "Ten High"],
      [claim(3), "removed-milestone"],
      [claim(1), "First Run"],
    ]);
  });

  it("is empty for a player with no records", () => {
    expect(
      publicProfileModel({ ...view, bests: [], mints: [] }, [runner]),
    ).toMatchObject({ bests: [], mints: [] });
  });
});
