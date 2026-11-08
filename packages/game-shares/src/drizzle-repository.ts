import type { DatabaseClient } from "@frostbite/database/connection";
import { gameShares } from "@frostbite/database/schema/game-shares";
import { and, eq, isNull, type SQL } from "drizzle-orm";

import type {
  GameShareRepository,
  SharedThing,
  StoredShare,
} from "./repository.ts";

type Row = typeof gameShares.$inferSelect;

// A row back into what it shows. The shape check in the table makes the missing columns of each kind impossible.
function thingOf(row: Row): SharedThing {
  if (row.kind === "milestones") return { kind: "milestones" };
  /* v8 ignore next -- the shape CHECK rejects every row that would reach this. */
  if (row.gameId === null) throw new Error("A share lost its game.");
  if (row.kind === "score") {
    /* v8 ignore next -- the shape CHECK rejects every row that would reach this. */
    if (row.score === null) throw new Error("A score share lost its score.");
    return {
      gameId: row.gameId,
      kind: "score",
      score: row.score,
      verification: "self-reported",
    };
  }
  /* v8 ignore next 2 -- the shape CHECK rejects every row that would reach this. */
  if (row.milestoneId === null)
    throw new Error("A milestone share lost its milestone.");
  return {
    gameId: row.gameId,
    kind: "milestone",
    milestoneId: row.milestoneId,
    verification:
      row.verification === "replay-verified"
        ? "replay-verified"
        : "self-reported",
  };
}

const storedOf = (row: Row): StoredShare => ({
  createdAt: row.createdAt,
  id: row.id,
  thing: thingOf(row),
  userId: row.userId,
});

// The columns a share is stored in, which the unique indexes also key on.
function columnsOf(thing: SharedThing) {
  return {
    gameId: thing.kind === "milestones" ? null : thing.gameId,
    kind: thing.kind,
    milestoneId: thing.kind === "milestone" ? thing.milestoneId : null,
    score: thing.kind === "score" ? thing.score : null,
    verification: thing.kind === "milestones" ? null : thing.verification,
  };
}

// The player's live share of the same thing: the row a new one would collide with.
function sameThing(userId: string, thing: SharedThing): SQL | undefined {
  const columns = columnsOf(thing);
  return and(
    eq(gameShares.userId, userId),
    eq(gameShares.kind, columns.kind),
    columns.gameId === null
      ? isNull(gameShares.gameId)
      : eq(gameShares.gameId, columns.gameId),
    columns.milestoneId === null
      ? isNull(gameShares.milestoneId)
      : eq(gameShares.milestoneId, columns.milestoneId),
    columns.score === null
      ? isNull(gameShares.score)
      : eq(gameShares.score, columns.score),
    isNull(gameShares.revokedAt),
  );
}

export function createDrizzleGameShareRepository(
  database: DatabaseClient,
): GameShareRepository {
  return {
    createOrGet: async (share) => {
      // A live share that is revoked between the insert and the read is replaced by one more try; it cannot happen twice in a row.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await database
          .insert(gameShares)
          .values({
            ...columnsOf(share.thing),
            createdAt: share.createdAt,
            id: share.id,
            userId: share.userId,
          })
          .onConflictDoNothing();
        const [row] = await database
          .select()
          .from(gameShares)
          .where(sameThing(share.userId, share.thing));
        if (row !== undefined) return storedOf(row);
      }
      /* v8 ignore next -- a live share revoked between the insert and the read, twice in a row. */
      throw new Error("A share could not be made or found.");
    },
    get: async (id) => {
      const [row] = await database
        .select()
        .from(gameShares)
        .where(and(eq(gameShares.id, id), isNull(gameShares.revokedAt)));
      return row === undefined ? null : storedOf(row);
    },
    revoke: async (userId, id, at) =>
      (
        await database
          .update(gameShares)
          .set({ revokedAt: at })
          .where(
            and(
              eq(gameShares.id, id),
              eq(gameShares.userId, userId),
              isNull(gameShares.revokedAt),
            ),
          )
          .returning({ id: gameShares.id })
      ).length === 1,
  };
}
