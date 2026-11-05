import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@frostbite/database/connection";
import { gameRuns } from "@frostbite/database/schema/game-runs";
import { and, eq, lte, sql } from "drizzle-orm";

import type {
  GameRunRepository,
  RunState,
  RunVerdict,
  StoredRun,
} from "./repository.ts";

export interface DrizzleGameRunOptions {
  readonly clock: () => Date;
  // Called inside the settling transaction when a run is verified and earned something, so what it earned is written with
  // the verdict or not at all (the verified milestones of the player's record).
  readonly onVerified?: (
    transaction: DatabaseTransaction,
    run: StoredRun,
    earned: readonly string[],
    at: Date,
  ) => Promise<void>;
}

type Row = typeof gameRuns.$inferSelect;

const toRun = (row: Row): StoredRun => ({
  expiresAt: row.expiresAt,
  gameId: row.gameId,
  id: row.id,
  issuedAt: row.issuedAt,
  seed: row.seed,
  // The column's check constraint admits only these three.
  state: row.state as RunState,
  userId: row.userId,
  verifierDigest: row.verifierDigest,
});

export function createDrizzleGameRunRepository(
  database: DatabaseClient,
  options: DrizzleGameRunOptions,
): GameRunRepository {
  return {
    issue: (run, maxOpenRuns) =>
      database.transaction(async (transaction) => {
        // One start at a time per player and game, so two cannot both see room under the limit.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`game-runs:${run.userId}:${run.gameId}`}, 0))`,
        );
        const now = options.clock();
        // A run left open past its time is spent: it is marked so, and only the runs still issued after this count as open.
        await transaction
          .update(gameRuns)
          .set({ state: "expired" })
          .where(
            and(
              eq(gameRuns.userId, run.userId),
              eq(gameRuns.gameId, run.gameId),
              eq(gameRuns.state, "issued"),
              lte(gameRuns.expiresAt, now),
            ),
          );
        const counted = await transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(gameRuns)
          .where(
            and(
              eq(gameRuns.userId, run.userId),
              eq(gameRuns.gameId, run.gameId),
              eq(gameRuns.state, "issued"),
            ),
          );
        // One row holds the count; summing it leaves no case for a missing row.
        const open = counted.reduce((total, { count }) => total + count, 0);
        if (open >= maxOpenRuns)
          return { code: "too-many-open-runs", ok: false } as const;
        await transaction.insert(gameRuns).values(run);
        return { ok: true } as const;
      }),

    submit: (key, decide) =>
      database.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(gameRuns)
          .where(
            and(
              eq(gameRuns.id, key.runId),
              eq(gameRuns.userId, key.userId),
              eq(gameRuns.gameId, key.gameId),
            ),
          )
          .for("update");
        // Not the player's run, not this game's, or not a run at all: the same answer, so a run id says nothing to others.
        if (row === undefined) return { code: "not-found", ok: false } as const;
        const run = toRun(row);
        const decision = decide(run);
        if (decision.kind === "refuse") {
          if (decision.expire && run.state === "issued")
            await transaction
              .update(gameRuns)
              .set({ state: "expired" })
              .where(eq(gameRuns.id, run.id));
          return { code: decision.code, ok: false } as const;
        }
        const at = options.clock();
        const { verdict } = decision;
        await transaction
          .update(gameRuns)
          .set(settled(verdict, at))
          .where(eq(gameRuns.id, run.id));
        if (verdict.status === "verified" && verdict.earned.length > 0)
          await options.onVerified?.(transaction, run, verdict.earned, at);
        return {
          ok: true,
          run: { ...run, state: "submitted" },
          verdict,
        } as const;
      }),
  };
}

const settled = (verdict: RunVerdict, at: Date) => ({
  earned: [...verdict.earned],
  recordDigest: verdict.recordDigest,
  recordText: verdict.recordText,
  state: "submitted",
  submittedAt: at,
  verdict: verdict.status,
  verdictReason: verdict.reason,
});
