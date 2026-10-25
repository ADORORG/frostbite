import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import { authSessions, authUsers } from "@ador/database/schema/auth";
import {
  contactCodes,
  contactIdentities,
} from "@ador/database/schema/contact-sign-in";
import { createUuidV7 } from "@ador/shared/identifiers";
import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";

import type { ContactCodeRepository } from "./repository.ts";

// Everything about one destination (sending, trying, creating its account) is serialized on this lock, so the limits and the "one
// account per address" rule hold when requests arrive together.
async function lockDestination(
  transaction: DatabaseTransaction,
  kind: string,
  destination: string,
): Promise<void> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`contact:${kind}:${destination}`}, 0))`,
  );
}

export function createDrizzleContactCodeRepository(
  database: DatabaseClient,
): ContactCodeRepository {
  return {
    issue: (input) =>
      database.transaction(async (transaction) => {
        await lockDestination(transaction, input.kind, input.destination);
        const sentTo = and(
          eq(contactCodes.kind, input.kind),
          eq(contactCodes.destination, input.destination),
        );
        const [latest] = await transaction
          .select({ issuedAt: contactCodes.issuedAt })
          .from(contactCodes)
          .where(sentTo)
          .orderBy(desc(contactCodes.issuedAt))
          .limit(1);
        const sinceLast =
          latest === undefined
            ? Number.POSITIVE_INFINITY
            : input.issuedAt.getTime() - latest.issuedAt.getTime();
        if (sinceLast < input.limits.cooldownMs)
          return {
            kind: "cooldown",
            retryAfterMs: input.limits.cooldownMs - sinceLast,
          };
        const windowStart = new Date(
          input.issuedAt.getTime() - input.limits.windowMs,
        );
        // The sends still inside the window, oldest first. There are never more than the limit, because a send is recorded only below it.
        const [oldest, ...later] = await transaction
          .select({ issuedAt: contactCodes.issuedAt })
          .from(contactCodes)
          .where(and(sentTo, gt(contactCodes.issuedAt, windowStart)))
          .orderBy(asc(contactCodes.issuedAt));
        // The next send is allowed once the oldest one counted has left the window.
        if (
          oldest !== undefined &&
          later.length + 1 >= input.limits.maximumPerWindow
        )
          return {
            kind: "limit",
            retryAfterMs:
              oldest.issuedAt.getTime() +
              input.limits.windowMs -
              input.issuedAt.getTime(),
          };
        // Only the newest code works: asking again replaces the earlier ones.
        await transaction
          .update(contactCodes)
          .set({ consumedAt: input.issuedAt })
          .where(and(sentTo, isNull(contactCodes.consumedAt)));
        await transaction.insert(contactCodes).values({
          codeHash: input.codeHash,
          destination: input.destination,
          expiresAt: input.expiresAt,
          id: input.id,
          issuedAt: input.issuedAt,
          kind: input.kind,
          purpose: input.purpose,
          salt: input.salt,
          userId: input.userId,
        });
        return { kind: "issued" };
      }),

    async discard(id) {
      await database.delete(contactCodes).where(eq(contactCodes.id, id));
    },

    takeAttempt: (input) =>
      database.transaction(async (transaction) => {
        await lockDestination(transaction, input.kind, input.destination);
        const [live] = await transaction
          .select()
          .from(contactCodes)
          .where(
            and(
              eq(contactCodes.kind, input.kind),
              eq(contactCodes.destination, input.destination),
              input.userId === null
                ? isNull(contactCodes.userId)
                : eq(contactCodes.userId, input.userId),
              isNull(contactCodes.consumedAt),
              gt(contactCodes.expiresAt, input.now),
              lt(contactCodes.attempts, input.maximumAttempts),
            ),
          )
          .orderBy(desc(contactCodes.issuedAt))
          .limit(1);
        if (live === undefined) return null;
        await transaction
          .update(contactCodes)
          .set({ attempts: sql`${contactCodes.attempts} + 1` })
          .where(eq(contactCodes.id, live.id));
        return { codeHash: live.codeHash, id: live.id, salt: live.salt };
      }),

    completeSignIn: (input) =>
      database.transaction(async (transaction) => {
        await lockDestination(transaction, input.kind, input.destination);
        // The code is spent first, by one statement: of any number of attempts with it, exactly one gets a row back.
        const [spent] = await transaction
          .update(contactCodes)
          .set({ consumedAt: input.now })
          .where(
            and(
              eq(contactCodes.id, input.codeId),
              eq(contactCodes.purpose, "sign-in"),
              isNull(contactCodes.consumedAt),
              gt(contactCodes.expiresAt, input.now),
            ),
          )
          .returning({ id: contactCodes.id });
        if (spent === undefined) return { kind: "conflict" };
        const [existing] = await transaction
          .select({ userId: contactIdentities.userId })
          .from(contactIdentities)
          .where(
            and(
              eq(contactIdentities.kind, input.kind),
              eq(contactIdentities.value, input.destination),
            ),
          )
          .limit(1);
        let userId = existing?.userId;
        if (userId === undefined) {
          userId = createUuidV7();
          // `auth_users.email` is a required, unique column that is not an identity here; the address lives in `contact_identities`.
          await transaction.insert(authUsers).values({
            email: `contact-${userId}@contact.invalid`,
            id: userId,
            name: input.accountName,
          });
          await transaction.insert(contactIdentities).values({
            createdAt: input.now,
            id: createUuidV7(),
            kind: input.kind,
            userId,
            value: input.destination,
            verifiedAt: input.now,
          });
        }
        await transaction.insert(authSessions).values({
          ...input.session,
          id: createUuidV7(),
          userId,
        });
        return { kind: "signed-in", userId };
      }),
  };
}
