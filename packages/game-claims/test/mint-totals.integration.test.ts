import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  authUsers,
  gameMilestoneClaims,
  gameMintTotals,
} from "@frostbite/database";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { claim, sentAt } from "./support/claim-rows.ts";
import { database, registerDatabase, seedUser } from "./support/fixture.ts";

registerDatabase();

let counter = 0;
// Each test works on a game of its own: the database lasts for the whole file.
const freshGame = () => {
  counter += 1;
  return `totals-game-${String(counter)}`;
};
const rollupOf = async (gameId: string) =>
  (
    await database
      .select()
      .from(gameMintTotals)
      .where(eq(gameMintTotals.gameId, gameId))
  )[0];
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

describe("the totals kept for each game", () => {
  it("follow a claim becoming complete, once, and not its moves among the states before it", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    const row = claim(user, gameId, "awaiting_signature", {
      platformFeeSats: 1_500n,
    });
    await database.insert(gameMilestoneClaims).values(row);
    expect(await rollupOf(gameId)).toBeUndefined();
    await database
      .update(gameMilestoneClaims)
      .set({ signedPayload: "signed", state: "signed" })
      .where(eq(gameMilestoneClaims.id, row.id as string));
    expect(await rollupOf(gameId)).toBeUndefined();
    await complete(row.id as string);
    expect(await rollupOf(gameId)).toEqual({
      completed: 1,
      feesSats: 1_500n,
      gameId,
    });
    // Touching a complete claim without changing what the totals are made of changes nothing.
    await database
      .update(gameMilestoneClaims)
      .set({ collectibleId: "item-1" })
      .where(eq(gameMilestoneClaims.id, row.id as string));
    expect(await rollupOf(gameId)).toMatchObject({ completed: 1 });
  });

  it("follow a claim leaving complete, and a complete claim's fee or game being corrected", async () => {
    const gameId = freshGame();
    const moved = freshGame();
    const user = await seedUser();
    const [first, second] = [
      claim(user, gameId, "complete", { platformFeeSats: 100n }),
      claim(user, gameId, "complete", { platformFeeSats: 200n }),
    ];
    await database.insert(gameMilestoneClaims).values([first!, second!]);
    await database
      .update(gameMilestoneClaims)
      .set({ platformFeeSats: 150n })
      .where(eq(gameMilestoneClaims.id, first!.id as string));
    expect(await rollupOf(gameId)).toMatchObject({
      completed: 2,
      feesSats: 350n,
    });
    await database
      .update(gameMilestoneClaims)
      .set({ gameId: moved })
      .where(eq(gameMilestoneClaims.id, second!.id as string));
    expect(await rollupOf(gameId)).toMatchObject({
      completed: 1,
      feesSats: 150n,
    });
    expect(await rollupOf(moved)).toMatchObject({
      completed: 1,
      feesSats: 200n,
    });
    await database
      .update(gameMilestoneClaims)
      .set({
        broadcastAt: null,
        signedPayload: null,
        state: "expired",
        transactionId: null,
      })
      .where(eq(gameMilestoneClaims.id, first!.id as string));
    expect(await rollupOf(gameId)).toMatchObject({
      completed: 0,
      feesSats: 0n,
    });
  });

  it("keep a mint when its player's account is deleted: the mint happened and the fee was paid", async () => {
    const gameId = freshGame();
    const user = await seedUser();
    await database
      .insert(gameMilestoneClaims)
      .values(claim(user, gameId, "complete", { platformFeeSats: 1_500n }));
    await database.delete(authUsers).where(eq(authUsers.id, user));
    expect(await rollupOf(gameId)).toEqual({
      completed: 1,
      feesSats: 1_500n,
      gameId,
    });
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
          claim(user, gameId, "complete", { platformFeeSats: 0n }),
          claim(user, gameId, "complete", { platformFeeSats: 0n }),
          claim(user, gameId, "signed"),
        ]);
    } finally {
      await database.execute(
        sql`alter table frostbite.game_milestone_claims enable trigger user`,
      );
    }
    expect(await rollupOf(gameId)).toBeUndefined();
    // The last statement of the migration, run as the migration runs it.
    const migrations = resolve(
      import.meta.dirname,
      "../../database/migrations",
    );
    const file = readdirSync(migrations).find((name) =>
      name.endsWith("_platform_fee"),
    );
    const script = readFileSync(
      resolve(migrations, file ?? "missing", "migration.sql"),
      "utf8",
    );
    const backfill = script.slice(
      script.lastIndexOf('INSERT INTO "frostbite"."game_mint_totals"'),
    );
    await database.execute(
      sql.raw(
        `${backfill.replace("GROUP BY game_id;", `AND game_id = '${gameId}' GROUP BY game_id;`)}`,
      ),
    );
    expect(await rollupOf(gameId)).toEqual({
      completed: 2,
      feesSats: 0n,
      gameId,
    });
  });
});
