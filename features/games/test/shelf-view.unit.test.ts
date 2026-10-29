import type { MintedMilestone } from "@ador/shared/games";
import { defineGame } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { shelfStats, shelves } from "../src/domain/shelf-view.ts";
import { bareGame, chains, rewardsGame } from "./support/template-game.ts";

const other = defineGame({
  ...rewardsGame,
  id: "other-game",
  title: "Other game",
});
const games = createGameCatalog([bareGame, rewardsGame, other], chains).list();
const [first, second] = rewardsGame.milestones;
const href = (id: string) => `/games/${id}`;
let counter = 0;
const mint = (over: Partial<MintedMilestone> = {}): MintedMilestone => ({
  claimId: `0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f${String((counter += 1)).padStart(2, "0")}`,
  gameId: rewardsGame.id,
  milestoneId: first?.id ?? "",
  mintedAt: "2026-10-17T12:00:00.000Z",
  transactionId: "ab".repeat(32),
  ...over,
});

describe("the shelves", () => {
  it("has a shelf for every game that can mint milestones, listing each milestone not minted as still to earn, and none for a game that cannot", () => {
    const result = shelves([], games, href);
    expect(result.map(({ gameId }) => gameId)).toEqual([
      rewardsGame.id,
      other.id,
    ]);
    expect(result[0]).toMatchObject({ earned: 0, total: 2 });
    expect(result[0]?.pieces).toEqual([]);
    expect(result[0]?.missing.map(({ milestoneId }) => milestoneId)).toEqual(
      rewardsGame.milestones.map(({ id }) => id),
    );
    expect(result[0]?.gameHref).toBe(`/games/${rewardsGame.id}`);
  });

  it("puts games with mints first, newest mint first, and the rest after in catalog order", () => {
    const result = shelves(
      [
        mint({ gameId: other.id, mintedAt: "2026-10-20T00:00:00.000Z" }),
        mint({ mintedAt: "2026-10-10T00:00:00.000Z" }),
      ],
      games,
      href,
    );
    expect(result.map(({ gameId }) => gameId)).toEqual([
      other.id,
      rewardsGame.id,
    ]);
  });

  it("shows a minted milestone as a piece in the game's own order, and counts a milestone once however often it was minted", () => {
    const a = mint({ mintedAt: "2026-10-10T00:00:00.000Z" });
    const b = mint({ mintedAt: "2026-10-12T00:00:00.000Z" });
    const [shelf] = shelves([b, a], games, href);
    expect(shelf?.earned).toBe(1);
    expect(shelf?.total).toBe(2);
    expect(shelf?.pieces.map(({ claimId }) => claimId)).toEqual([
      b.claimId,
      a.claimId,
    ]);
    expect(shelf?.missing).toEqual([
      { milestoneId: second?.id, title: second?.title },
    ]);
  });

  it("carries what the detail view needs and the day in UTC", () => {
    const item = mint({ mintedAt: "2026-10-17T23:59:00.000Z" });
    const [shelf] = shelves([item], games, href);
    expect(shelf?.pieces[0]).toMatchObject({
      claimId: item.claimId,
      description: first?.description,
      mintedDay: "17 Oct 2026",
      title: first?.title,
      transactionId: item.transactionId,
    });
  });

  it("marks the game's first mint, and the newest of all as the latest, which wins", () => {
    const oldest = mint({ mintedAt: "2026-10-01T00:00:00.000Z" });
    const middle = mint({ mintedAt: "2026-10-05T00:00:00.000Z" });
    const newest = mint({
      gameId: other.id,
      mintedAt: "2026-10-09T00:00:00.000Z",
    });
    const ribbons = (claimIds: string[]) =>
      shelves([oldest, middle, newest], games, href)
        .flatMap(({ pieces }) => pieces)
        .filter(({ claimId }) => claimIds.includes(claimId))
        .map(({ ribbon }) => ribbon);
    expect(ribbons([oldest.claimId])).toEqual(["first"]);
    expect(ribbons([middle.claimId])).toEqual([null]);
    expect(ribbons([newest.claimId])).toEqual(["latest"]);
  });

  it("calls a lone mint the first, not the latest: there is nothing to tell it from", () => {
    const [shelf] = shelves([mint()], games, href);
    expect(shelf?.pieces[0]).toMatchObject({ ribbon: "first" });
  });

  it("keeps a mint of a withdrawn game or milestone under its identifier instead of hiding it", () => {
    const result = shelves(
      [mint({ gameId: "withdrawn" }), mint({ milestoneId: "retired" })],
      games,
      href,
    );
    const gone = result.find(({ gameId }) => gameId === "withdrawn");
    expect(gone).toMatchObject({ earned: 1, gameTitle: "withdrawn", total: 1 });
    expect(gone?.pieces[0]).toMatchObject({ title: first?.id });
    const renamed = result.find(({ gameId }) => gameId === rewardsGame.id);
    expect(renamed).toMatchObject({ earned: 1, total: 3 });
    expect(renamed?.pieces.some(({ title }) => title === "retired")).toBe(true);
  });
});

describe("the collection's facts", () => {
  it("is empty of dates before the first mint", () => {
    expect(shelfStats([], games)).toEqual({
      firstDay: null,
      games: 0,
      latest: null,
      pieces: 0,
    });
  });

  it("counts mints and games, and names the first day and the newest milestone", () => {
    const stats = shelfStats(
      [
        mint({ mintedAt: "2026-10-01T10:00:00.000Z" }),
        mint({ mintedAt: "2026-10-09T10:00:00.000Z", milestoneId: "retired" }),
        mint({ gameId: other.id, mintedAt: "2026-10-05T10:00:00.000Z" }),
      ],
      games,
    );
    expect(stats).toEqual({
      firstDay: "1 Oct 2026",
      games: 2,
      latest: { day: "9 Oct 2026", title: "retired" },
      pieces: 3,
    });
    expect(
      shelfStats([mint({ mintedAt: "2026-10-09T10:00:00.000Z" })], games).latest
        ?.title,
    ).toBe(first?.title);
  });
});
