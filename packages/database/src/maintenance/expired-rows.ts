import { and, eq, inArray, lt, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { DatabaseClient } from "../connection/client.ts";
import { passkeyChallenges, walletChallenges } from "../schema/auth.ts";
import { contactCodes } from "../schema/contact-sign-in.ts";
import { passkeySignInChallenges } from "../schema/passkey-sign-in.ts";
import { outboxEvents } from "../schema/outbox.ts";

const positiveInteger = z.number().int().min(1);

export const expiredRowLimitsSchema = z.strictObject({
  // The most rows removed from one table by one call.
  batchSize: positiveInteger,
  // How long a contact code is kept after it was issued (and not before it expired): the send limits look back over it.
  contactCodeRetentionMs: positiveInteger,
  // How long a delivered outbox row is kept after it was delivered.
  deliveredOutboxRetentionMs: positiveInteger,
});
export type ExpiredRowLimits = z.input<typeof expiredRowLimitsSchema>;

export interface ExpiredRowCounts {
  readonly contactCodes: number;
  readonly deliveredOutboxEvents: number;
  readonly passkeyChallenges: number;
  readonly passkeySignInChallenges: number;
  readonly walletChallenges: number;
}

// Removes at most `limit` rows that match, oldest first, and says how many went. Removed by key from a bounded selection, so one call
// never holds more than a batch, and a row that stopped matching in between (or was removed by a call running alongside) is simply skipped.
async function removeBatch(
  database: DatabaseClient,
  table: PgTable,
  key: PgColumn,
  orderedBy: PgColumn,
  where: SQL | undefined,
  limit: number,
): Promise<number> {
  const removed = await database
    .delete(table)
    .where(
      inArray(
        key,
        database
          .select({ key })
          .from(table)
          .where(where)
          .orderBy(orderedBy)
          .limit(limit),
      ),
    )
    .returning({ key });
  return removed.length;
}

// One pass of the housekeeping for rows that have finished their work (nothing here is read again after the cut-off it names):
// - a wallet, passkey or passkey sign-in challenge once it has expired (it is looked up by its id, only while it can still be used);
// - a contact code once it has expired AND is older than the send limits' look-back (they count recent codes, expired or not);
// - a delivered outbox row once it is older than its retention (a failed, waiting or in-flight row is never touched).
// Each table is cleared in a batch of at most `batchSize`, so the caller goes again while a pass removes anything.
export async function removeExpiredRows(
  database: DatabaseClient,
  now: Date,
  limitsInput: ExpiredRowLimits,
): Promise<ExpiredRowCounts> {
  const limits = expiredRowLimitsSchema.parse(limitsInput);
  const before = (ms: number) => new Date(now.getTime() - ms);
  return {
    contactCodes: await removeBatch(
      database,
      contactCodes,
      contactCodes.id,
      contactCodes.issuedAt,
      and(
        lt(contactCodes.expiresAt, now),
        lt(contactCodes.issuedAt, before(limits.contactCodeRetentionMs)),
      ),
      limits.batchSize,
    ),
    deliveredOutboxEvents: await removeBatch(
      database,
      outboxEvents,
      outboxEvents.eventId,
      outboxEvents.deliveredAt,
      and(
        eq(outboxEvents.status, "delivered"),
        lt(outboxEvents.deliveredAt, before(limits.deliveredOutboxRetentionMs)),
      ),
      limits.batchSize,
    ),
    passkeyChallenges: await removeBatch(
      database,
      passkeyChallenges,
      passkeyChallenges.id,
      passkeyChallenges.expiresAt,
      lt(passkeyChallenges.expiresAt, now),
      limits.batchSize,
    ),
    passkeySignInChallenges: await removeBatch(
      database,
      passkeySignInChallenges,
      passkeySignInChallenges.id,
      passkeySignInChallenges.expiresAt,
      lt(passkeySignInChallenges.expiresAt, now),
      limits.batchSize,
    ),
    walletChallenges: await removeBatch(
      database,
      walletChallenges,
      walletChallenges.id,
      walletChallenges.expiresAt,
      lt(walletChallenges.expiresAt, now),
      limits.batchSize,
    ),
  };
}
