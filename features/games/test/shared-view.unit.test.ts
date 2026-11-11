import { describe, expect, it } from "vitest";

import { shareCopy } from "../src/domain/share-copy.ts";
import { cardKicker, sharedView } from "../src/domain/shared-view.ts";
import { sharedMetadata } from "../src/metadata.ts";
import { coveredGame, templateGame } from "./support/template-game.ts";

const games = [templateGame, coveredGame];
const id = "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";

describe("what a shared link shows", () => {
  it("a score is written with grouped digits, asks the question, and is only ever self-reported", () => {
    const view = sharedView(
      {
        gameId: "template-game",
        kind: "score",
        score: 1234567,
        verification: "self-reported",
      },
      games,
    );
    expect(view).toMatchObject({
      kicker: "Score",
      playHref: "/games/template-game",
      playLabel: "Play Template game",
      subtitle: shareCopy.scoreSubtitle,
      title: "1,234,567 in Template game",
      verification: "self-reported",
    });
  });

  it("a milestone takes its title from the game's own declaration and keeps the account's level", () => {
    const view = sharedView(
      {
        gameId: "template-game",
        kind: "milestone",
        milestoneId: "first-level",
        verification: "replay-verified",
      },
      games,
    );
    expect(view).toMatchObject({
      title: "First level",
      verification: "replay-verified",
    });
    expect(view && cardKicker(view)).toBe("Milestone · Verified by replay");
  });

  it("the case names no game, no level and nobody", () => {
    const view = sharedView({ kind: "milestones" }, games);
    expect(view).toMatchObject({
      gameId: null,
      playHref: "/games",
      title: shareCopy.collectionTitle,
      verification: null,
    });
    expect(view && cardKicker(view)).toBe("Milestones");
  });

  it("has no view for a game that is no longer listed, or a milestone it no longer declares", () => {
    expect(
      sharedView(
        {
          gameId: "gone",
          kind: "score",
          score: 1,
          verification: "self-reported",
        },
        games,
      ),
    ).toBeNull();
    expect(
      sharedView(
        {
          gameId: "template-game",
          kind: "milestone",
          milestoneId: "removed",
          verification: "self-reported",
        },
        games,
      ),
    ).toBeNull();
  });
});

describe("a shared link's page metadata", () => {
  const score = {
    gameId: "template-game",
    kind: "score",
    score: 90,
    verification: "self-reported",
  } as const;

  it("names the thing, says nothing about how a reported one is known, and points at the picture made for this link", () => {
    expect(sharedMetadata(id, score, games)).toEqual({
      description: "Can you beat it?",
      image: { alt: "90 in Template game", path: `/s/${id}/share-image` },
      kind: "shared",
      title: "90 in Template game",
    });
  });

  it("says nothing for a link that is ended or never was, and for one whose game has gone", () => {
    expect(sharedMetadata(id, null, games)).toEqual({ kind: "private" });
    expect(sharedMetadata(id, score, [])).toEqual({ kind: "private" });
  });
});
