import type { DatabaseClient } from "@ador/database";
import { walletQualificationChallenges as challenges } from "@ador/database/schema/wallet-qualification";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { QualificationRepository } from "./service.ts";
import { uuidV7Schema } from "@ador/shared/identifiers";

export function createDrizzleQualificationRepository(
  database: DatabaseClient,
): QualificationRepository {
  return {
    async issue(challenge) {
      await database.insert(challenges).values(challenge);
    },
    async find(id) {
      const [row] = await database
        .select()
        .from(challenges)
        .where(eq(challenges.id, id));
      return row ? { ...row, id: uuidV7Schema.parse(row.id) } : null;
    },
    async settle(id, passed, clock, maximumAttempts) {
      return database.transaction(async (transaction) => {
        // Sample time only after lock acquisition: verification and lock waits can
        // cross the deadline. The conditional update remains the settlement guard.
        await transaction
          .select({ id: challenges.id })
          .from(challenges)
          .where(eq(challenges.id, id))
          .for("update");
        const now = clock();
        const rows = await transaction
          .update(challenges)
          .set(
            passed
              ? { consumedAt: now }
              : { attempts: sql`${challenges.attempts} + 1` },
          )
          .where(
            and(
              eq(challenges.id, id),
              isNull(challenges.consumedAt),
              gt(challenges.expiresAt, now),
              lt(challenges.attempts, maximumAttempts),
            ),
          )
          .returning({ id: challenges.id });
        return rows.length === 1;
      });
    },
  };
}
