import type { MintedMilestone } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { createGameCatalog } from "../src/domain/catalog.ts";
import { mintedDay, mintedRows } from "../src/domain/minted-view.ts";
import { chains, rewardsGame } from "./support/template-game.ts";

const [game] = createGameCatalog([rewardsGame], chains).list();
const mint = (over: Partial<MintedMilestone> = {}): MintedMilestone => ({
  claimId: "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a",
  gameId: rewardsGame.id,
  milestoneId: rewardsGame.milestones[0]?.id ?? "",
  mintedAt: "2026-10-17T12:34:56.000Z",
  transactionId: "ab".repeat(32),
  ...over,
});
const href = (id: string) => `/games/${id}`;

describe("the day of a mint", () => {
  it("is the day in UTC, not the reader's, so a late-evening mint reads the same everywhere", () => {
    expect(mintedDay("2026-10-17T12:34:56.000Z")).toBe("17 Oct 2026");
    expect(mintedDay("2026-10-17T23:59:59.000Z")).toBe("17 Oct 2026");
    expect(mintedDay("2026-10-18T00:00:00.000Z")).toBe("18 Oct 2026");
  });
});

describe("a minted milestone as a row", () => {
  it("is named by its game and milestone, and links to the game", () => {
    if (game === undefined) throw new Error("no game");
    const [row] = mintedRows([mint()], [game], href);
    expect(row).toMatchObject({
      gameHref: `/games/${rewardsGame.id}`,
      gameTitle: rewardsGame.title,
      milestoneTitle: rewardsGame.milestones[0]?.title,
      mintedDay: "17 Oct 2026",
    });
    expect(row).not.toHaveProperty("transactionId");
  });

  it("keeps the order it was given", () => {
    if (game === undefined) throw new Error("no game");
    const rows = mintedRows(
      [mint({ claimId: "b" }), mint({ claimId: "a" })],
      [game],
      href,
    );
    expect(rows.map((row) => row.claimId)).toEqual(["b", "a"]);
  });

  it("falls back to the identifiers for a game or milestone the catalog no longer lists, instead of hiding the mint", () => {
    if (game === undefined) throw new Error("no game");
    const [gone, renamed] = mintedRows(
      [mint({ gameId: "withdrawn" }), mint({ milestoneId: "retired" })],
      [game],
      href,
    );
    expect(gone).toMatchObject({
      gameTitle: "withdrawn",
      milestoneTitle: mint().milestoneId,
    });
    expect(renamed).toMatchObject({
      gameTitle: rewardsGame.title,
      milestoneTitle: "retired",
    });
  });
});
