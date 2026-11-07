import { gameMilestoneClaims } from "@frostbite/database";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createMintReport, mintQueries } from "../src/mint-report.ts";
import { claim, sentAt } from "./support/claim-rows.ts";
import { database, registerDatabase, seedUser } from "./support/fixture.ts";

registerDatabase();

const report = createMintReport(database);
const queries = mintQueries(database);
let counter = 0;
// Each test reports on a game of its own: the database lasts for the whole file.
const freshGame = () => {
  counter += 1;
  return `report-game-${String(counter)}`;
};

const totalsOf = async (gameId: string) => {
  const [totals] = await report.totalsFor([gameId]);
  if (totals === undefined)
    throw new Error("a game asked for was not answered");
  return totals;
};

describe("the mints of a game", () => {
  it("counts the completed ones, the ones on their way, and the fees the completed ones carried; failed and expired ones are in neither", async () => {
    const gameId = freshGame();
    const other = freshGame();
    const user = await seedUser();
    await database
      .insert(gameMilestoneClaims)
      .values([
        claim(user, gameId, "complete", { platformFeeSats: 1_500n }),
        claim(user, gameId, "complete", { platformFeeSats: 2_500n }),
        claim(user, gameId, "complete"),
        claim(user, gameId, "signed", { platformFeeSats: 9_999n }),
        claim(user, gameId, "awaiting_signature", { platformFeeSats: 9_999n }),
        claim(user, gameId, "expired", { platformFeeSats: 9_999n }),
        claim(user, other, "complete", { platformFeeSats: 7n }),
      ]);
    expect(await totalsOf(gameId)).toEqual({
      completed: 3,
      feesAccruedSats: 4_000n,
      gameId,
      inProgress: 2,
    });
    expect(await totalsOf(other)).toMatchObject({
      completed: 1,
      feesAccruedSats: 7n,
    });
  });

  it("answers for every game asked about, in the order asked, zeros for a game with no claims, and nothing for no games", async () => {
    const busy = freshGame();
    const quiet = freshGame();
    await database
      .insert(gameMilestoneClaims)
      .values(claim(await seedUser(), busy, "complete"));
    expect(await report.totalsFor([quiet, busy])).toEqual([
      { completed: 0, feesAccruedSats: 0n, gameId: quiet, inProgress: 0 },
      { completed: 1, feesAccruedSats: 0n, gameId: busy, inProgress: 0 },
    ]);
    expect(await report.totalsFor([])).toEqual([]);
  });

  it("sums fees past what a plain number holds, exactly", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    const big = 9_007_199_254_740_993n;
    await database
      .insert(gameMilestoneClaims)
      .values([
        claim(user, gameId, "complete", { platformFeeSats: big }),
        claim(user, gameId, "complete", { platformFeeSats: 1n }),
      ]);
    expect((await totalsOf(gameId)).feesAccruedSats).toBe(big + 1n);
  });

  it("lists the newest completed mints first, a page at a time, to the end", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    const rows = Array.from({ length: 7 }, (_unused, index) =>
      claim(user, gameId, "complete", {
        updatedAt: new Date(sentAt.getTime() + index * 60_000),
      }),
    );
    // Two at the same moment: the id breaks the tie, so no mint is skipped or repeated across a page edge.
    rows.push(
      claim(user, gameId, "complete", {
        updatedAt: new Date(sentAt.getTime() + 6 * 60_000),
      }),
    );
    await database
      .insert(gameMilestoneClaims)
      .values([...rows, claim(user, gameId, "signed")]);
    const seen: string[] = [];
    let page = await report.recent(gameId, 3);
    expect(page.mints).toHaveLength(3);
    for (;;) {
      seen.push(...page.mints.map((mint) => mint.claimId));
      if (page.next === null) break;
      page = await report.recent(gameId, 3, page.next);
    }
    expect(seen).toHaveLength(8);
    expect(new Set(seen)).toEqual(new Set(rows.map((row) => row.id as string)));
    const times = (await report.recent(gameId, 50)).mints.map((mint) =>
      mint.completedAt.getTime(),
    );
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});

describe("what the report costs", () => {
  it("is a row per game, the claims on their way by index, and a page by index: no table scan, no sort, however many mints there are", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database.insert(gameMilestoneClaims).values(
      Array.from({ length: 3_000 }, (_unused, index) =>
        claim(user, gameId, index % 3 === 0 ? "signed" : "complete", {
          platformFeeSats: BigInt(index),
          updatedAt: new Date(sentAt.getTime() + index * 1_000),
        }),
      ),
    );
    await database.execute(
      sql`vacuum (analyze) frostbite.game_milestone_claims`,
    );
    await database.execute(sql`analyze frostbite.game_mint_totals`);
    const explain = async (query: { getSQL(): ReturnType<typeof sql> }) =>
      JSON.stringify(
        await database.transaction(async (transaction) => {
          await transaction.execute(sql`set local enable_seqscan = off`);
          return transaction.execute(sql`explain ${query.getSQL()}`);
        }),
      );
    const totals = await explain(queries.completed([gameId]));
    expect(totals).toContain("game_mint_totals_pkey");
    const waiting = await explain(queries.inProgress([gameId]));
    expect(waiting).toContain("game_milestone_claims_game_state_idx");
    expect(waiting).not.toContain("Seq Scan");
    const first = await explain(queries.recent(gameId, 20));
    expect(first).toContain("game_milestone_claims_game_recent_idx");
    expect(first).not.toContain("Sort");
    const cursor = (await report.recent(gameId, 20)).next;
    if (cursor === null) throw new Error("a next page was expected");
    const next = await explain(queries.recent(gameId, 20, cursor));
    expect(next).toContain("game_milestone_claims_game_recent_idx");
    expect(next).not.toContain("Sort");
  });
});
