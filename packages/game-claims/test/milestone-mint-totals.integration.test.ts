import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  authUsers,
  gameMilestoneClaims,
  gameMilestoneMintTotals,
} from "@frostbite/database";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { claim, sentAt } from "./support/claim-rows.ts";
import {
  database,
  registerDatabase,
  repository,
  seedUser,
} from "./support/fixture.ts";

registerDatabase();

let counter = 0;
// Each test works on a game of its own: the database lasts for the whole file.
const freshGame = () => `milestone-totals-game-${String((counter += 1))}`;
const countOf = async (gameId: string, milestoneId: string) =>
  (
    await database
      .select()
      .from(gameMilestoneMintTotals)
      .where(
        and(
          eq(gameMilestoneMintTotals.gameId, gameId),
          eq(gameMilestoneMintTotals.milestoneId, milestoneId),
        ),
      )
  )[0]?.completed;
const complete = (id: string) =>
  database
    .update(gameMilestoneClaims)
    .set({
      broadcastAt: sentAt,
      signedPayload: "signed",
      state: "complete",
      transactionId: randomUUID().replaceAll("-", ""),
    })
    .where(eq(gameMilestoneClaims.id, id));
const expire = (id: string) =>
  database
    .update(gameMilestoneClaims)
    .set({
      broadcastAt: null,
      signedPayload: null,
      state: "expired",
      transactionId: null,
    })
    .where(eq(gameMilestoneClaims.id, id));

describe("the counts kept for each milestone", () => {
  it("follow a claim becoming complete, once, and not its moves among the states before it", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    const row = claim(user, gameId, "awaiting_signature", {
      milestoneId: "first-win",
    });
    await database.insert(gameMilestoneClaims).values(row);
    await database
      .update(gameMilestoneClaims)
      .set({ signedPayload: "signed", state: "signed" })
      .where(eq(gameMilestoneClaims.id, row.id as string));
    expect(await countOf(gameId, "first-win")).toBeUndefined();
    await complete(row.id as string);
    expect(await countOf(gameId, "first-win")).toBe(1);
    // Touching a complete claim without changing what the counts are made of changes nothing.
    await database
      .update(gameMilestoneClaims)
      .set({ collectibleId: "item-1" })
      .where(eq(gameMilestoneClaims.id, row.id as string));
    expect(await countOf(gameId, "first-win")).toBe(1);
  });

  it("count claims inserted already complete, across players, each milestone and game apart", async () => {
    const gameId = freshGame();
    const [one, two] = [await seedUser(), await seedUser()];
    await database
      .insert(gameMilestoneClaims)
      .values([
        claim(one, gameId, "complete", { milestoneId: "first-win" }),
        claim(two, gameId, "complete", { milestoneId: "first-win" }),
        claim(one, gameId, "complete", { milestoneId: "streak" }),
        claim(two, gameId, "signed", { milestoneId: "streak" }),
        claim(one, freshGame(), "complete", { milestoneId: "first-win" }),
      ]);
    expect(await repository.completeCounts(gameId)).toEqual(
      new Map([
        ["first-win", 2],
        ["streak", 1],
      ]),
    );
  });

  it("follow a claim leaving complete, and a complete claim's game or milestone being corrected", async () => {
    const gameId = freshGame();
    const moved = freshGame();
    const user = await seedUser();
    const [first, second, third] = [
      claim(user, gameId, "complete", { milestoneId: "a" }),
      claim(user, gameId, "complete", { milestoneId: "a" }),
      claim(user, gameId, "complete", { milestoneId: "b" }),
    ];
    await database.insert(gameMilestoneClaims).values([first, second, third]);
    await database
      .update(gameMilestoneClaims)
      .set({ gameId: moved })
      .where(eq(gameMilestoneClaims.id, second.id as string));
    expect(await countOf(gameId, "a")).toBe(1);
    expect(await countOf(moved, "a")).toBe(1);
    await database
      .update(gameMilestoneClaims)
      .set({ milestoneId: "c" })
      .where(eq(gameMilestoneClaims.id, third.id as string));
    expect(await countOf(gameId, "b")).toBe(0);
    expect(await countOf(gameId, "c")).toBe(1);
    await expire(first.id as string);
    expect(await countOf(gameId, "a")).toBe(0);
  });

  it("keep a mint when its player's account is deleted: the mint happened", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database
      .insert(gameMilestoneClaims)
      .values(claim(user, gameId, "complete", { milestoneId: "first-win" }));
    await database.delete(authUsers).where(eq(authUsers.id, user));
    expect(await countOf(gameId, "first-win")).toBe(1);
  });

  it("refuse to go below nothing", async () => {
    const gameId = freshGame();
    await database
      .insert(gameMilestoneMintTotals)
      .values({ completed: 0, gameId, milestoneId: "m" });
    await expect(
      database.execute(
        sql`update frostbite.game_milestone_mint_totals set completed = -1 where game_id = ${gameId}`,
      ),
    ).rejects.toThrow();
  });

  it("are read by the table's key, not by counting claims", async () => {
    const plan = await database.execute(
      sql`explain select milestone_id, completed from frostbite.game_milestone_mint_totals where game_id = 'x'`,
    );
    expect(JSON.stringify(plan)).not.toContain(
      "Seq Scan on game_milestone_claims",
    );
  });

  it("are what the migration's own backfill makes of the mints that were complete before it", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database.execute(
      sql`alter table frostbite.game_milestone_claims disable trigger user`,
    );
    try {
      await database
        .insert(gameMilestoneClaims)
        .values([
          claim(user, gameId, "complete", { milestoneId: "first-win" }),
          claim(user, gameId, "complete", { milestoneId: "first-win" }),
          claim(user, gameId, "signed", { milestoneId: "first-win" }),
        ]);
    } finally {
      await database.execute(
        sql`alter table frostbite.game_milestone_claims enable trigger user`,
      );
    }
    expect(await countOf(gameId, "first-win")).toBeUndefined();
    // The last statement of the migration, run as the migration runs it.
    const migrations = resolve(
      import.meta.dirname,
      "../../database/migrations",
    );
    const file = readdirSync(migrations).find((name) =>
      name.endsWith("_milestone_mint_totals"),
    );
    const script = readFileSync(
      resolve(migrations, file ?? "missing", "migration.sql"),
      "utf8",
    );
    const backfill = script.slice(
      script.lastIndexOf(
        'INSERT INTO "frostbite"."game_milestone_mint_totals"',
      ),
    );
    await database.execute(
      sql.raw(
        backfill.replace(
          "WHERE \"state\" = 'complete'",
          `WHERE "state" = 'complete' AND "game_id" = '${gameId}'`,
        ),
      ),
    );
    expect(await countOf(gameId, "first-win")).toBe(2);
  });
});
