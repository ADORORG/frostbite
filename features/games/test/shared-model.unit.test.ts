import type { MintedClaim } from "@frostbite/game-claims";
import { sharedPictureHref } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import {
  groupedNumber,
  sharedModel,
  sharedShelfLimit,
} from "../src/domain/shared-model.ts";
import { chains, templateGame } from "./support/template-game.ts";

const games = createGameCatalog([templateGame], chains).list();
const id = "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";
const mint = (claim: string, milestoneId: string, day = 17): MintedClaim => ({
  claimId: claim,
  gameId: "template-game",
  milestoneId,
  mintedAt: `2026-10-${String(day)}T12:00:00.000Z`,
  transactionId: "ab".repeat(32),
});
const claimA = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

describe("a milestone's page", () => {
  const thing = {
    gameId: "template-game",
    kind: "milestone",
    milestoneId: "first-level",
    verification: "replay-verified",
  } as const;

  it("shows what it is, how it is earned, the sharer's own mint with its picture, and how many players minted it", () => {
    const model = sharedModel({
      counts: new Map([["first-level", 128]]),
      games,
      id,
      mints: [mint(claimA, "first-level")],
      thing,
    });
    expect(model).toMatchObject({
      criteria: "Finish the first level.",
      description: "You finished the first level.",
      game: { id: "template-game", playHref: "/games/template-game" },
      kind: "milestone",
      mint: { day: "17 Oct 2026", picture: sharedPictureHref(id, claimA) },
      mintCount: 128,
      title: "First level",
      verification: "replay-verified",
    });
  });

  it("says nothing it does not know: no mint, no count", () => {
    expect(
      sharedModel({ counts: null, games, id, mints: [], thing }),
    ).toMatchObject({ mint: null, mintCount: null });
  });

  it("is gone when its game or its milestone is no longer listed", () => {
    expect(
      sharedModel({ counts: null, games: [], id, mints: [], thing }),
    ).toBeNull();
    expect(
      sharedModel({
        counts: null,
        games,
        id,
        mints: [],
        thing: { ...thing, milestoneId: "removed" },
      }),
    ).toBeNull();
  });
});

describe("a score's page", () => {
  it("writes the score with grouped digits, as self-reported, with the game", () => {
    expect(
      sharedModel({
        counts: null,
        games,
        id,
        mints: [],
        thing: {
          gameId: "template-game",
          kind: "score",
          score: 1234567,
          verification: "self-reported",
        },
      }),
    ).toMatchObject({
      game: { title: "Template game" },
      kind: "score",
      score: "1,234,567",
      verification: "self-reported",
    });
    expect(groupedNumber(1000)).toBe("1,000");
  });

  it("is gone when the game is", () => {
    expect(
      sharedModel({
        counts: null,
        games: [],
        id,
        mints: [],
        thing: {
          gameId: "template-game",
          kind: "score",
          score: 1,
          verification: "self-reported",
        },
      }),
    ).toBeNull();
  });
});

describe("a shelf's page", () => {
  const shelf = { kind: "milestones" } as const;

  it("lays out the sharer's pieces newest first with their pictures, skipping what the games no longer declare, and counts the games", () => {
    const model = sharedModel({
      counts: null,
      games,
      id,
      mints: [
        mint(claimA, "century", 18),
        mint("c2", "first-level"),
        mint("c3", "removed"),
      ],
      thing: shelf,
    });
    expect(model).toMatchObject({ games: 1, kind: "milestones", more: 0 });
    expect(
      model?.kind === "milestones" && model.pieces.map(({ title }) => title),
    ).toEqual(["Century", "First level"]);
    expect(model?.kind === "milestones" && model.pieces[0]?.picture).toBe(
      sharedPictureHref(id, claimA),
    );
  });

  it("shows as many as a page holds and counts the rest", () => {
    const many = Array.from({ length: sharedShelfLimit + 3 }, (_, at) =>
      mint(`claim-${String(at)}`, "century"),
    );
    const model = sharedModel({
      counts: null,
      games,
      id,
      mints: many,
      thing: shelf,
    });
    expect(model?.kind === "milestones" && model.pieces).toHaveLength(
      sharedShelfLimit,
    );
    expect(model).toMatchObject({ more: 3 });
  });

  it("is an empty shelf, not an error, when nothing is minted", () => {
    expect(
      sharedModel({ counts: null, games, id, mints: [], thing: shelf }),
    ).toMatchObject({
      games: 0,
      more: 0,
      pieces: [],
    });
  });
});
