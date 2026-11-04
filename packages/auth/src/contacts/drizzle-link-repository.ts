import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import { authSecurityEvents, authSessions } from "@ador/database/schema/auth";
import {
  contactCodes,
  contactIdentities,
} from "@ador/database/schema/contact-sign-in";
import { createUuidV7 } from "@ador/shared/identifiers";
import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";

import { lockActiveSession } from "../adapters/lock-active-session.ts";
import { sha256 } from "../domain/crypto.ts";
import type { ListMethods } from "../methods/contracts.ts";
import { removalOutcome } from "../methods/rule.ts";
import type { ContactLinkRepository } from "./link-repository.ts";

type Change = Parameters<ContactLinkRepository["unlink"]>[0];

async function lock(transaction: DatabaseTransaction, key: string) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}

// What every change to an account's ways in ends with: every session of the account is signed out, the change's own session starts, and the
// change is recorded. The fingerprint is a hash, so the audit row never holds the address.
async function replaceSessions(
  transaction: DatabaseTransaction,
  input: Change,
  action: "email-linked" | "email-unlinked",
): Promise<void> {
  await transaction
    .update(authSessions)
    .set({ revokedAt: input.now, updatedAt: input.now })
    .where(
      and(
        eq(authSessions.userId, input.userId),
        isNull(authSessions.revokedAt),
      ),
    );
  const replacementId = createUuidV7();
  await transaction.insert(authSessions).values({
    ...input.replacementSession,
    id: replacementId,
    userId: input.userId,
  });
  await transaction.insert(authSecurityEvents).values({
    action,
    actorUserId: input.userId,
    correlationId: input.correlationId,
    credentialFingerprint: sha256(`${input.kind}:${input.destination}`),
    id: createUuidV7(),
    sessionId: replacementId,
  });
}

// `listMethods` is the method registry's: whether an address may be removed depends on every method the account has, not on addresses alone.
export function createDrizzleContactLinkRepository(
  database: DatabaseClient,
  listMethods: ListMethods<DatabaseTransaction>,
): ContactLinkRepository {
  return {
    async list(userId, kind) {
      const rows = await database
        .select({
          addedAt: contactIdentities.createdAt,
          value: contactIdentities.value,
        })
        .from(contactIdentities)
        .where(
          and(
            eq(contactIdentities.userId, userId),
            eq(contactIdentities.kind, kind),
          ),
        )
        .orderBy(
          asc(contactIdentities.createdAt),
          asc(contactIdentities.value),
        );
      return rows;
    },

    completeLink: (input) =>
      database.transaction(async (transaction) => {
        // The address lock serializes this with any sign-in or link of the same address; the account lock, with any other change to the
        // account's addresses, so the count below is the count the insert lands on. The order (address, account, session) is the order
        // every other change takes them in, so none of them can wait on another in a circle.
        await lock(transaction, `contact:${input.kind}:${input.destination}`);
        await lock(transaction, input.userId);
        if (!(await lockActiveSession(transaction, input)))
          return { kind: "session-not-recent" };
        // Spent by one statement, and only if it was sent to this account (a code with an account is a link code: the table checks it): of
        // any number of attempts, exactly one gets a row.
        const [spent] = await transaction
          .update(contactCodes)
          .set({ consumedAt: input.now })
          .where(
            and(
              eq(contactCodes.id, input.codeId),
              eq(contactCodes.userId, input.userId),
              isNull(contactCodes.consumedAt),
              gt(contactCodes.expiresAt, input.now),
            ),
          )
          .returning({ id: contactCodes.id });
        if (spent === undefined) return { kind: "code-spent" };
        const [holder] = await transaction
          .select({ userId: contactIdentities.userId })
          .from(contactIdentities)
          .where(
            and(
              eq(contactIdentities.kind, input.kind),
              eq(contactIdentities.value, input.destination),
            ),
          )
          .limit(1);
        if (holder !== undefined)
          return {
            kind: holder.userId === input.userId ? "already-linked" : "taken",
          };
        const [held] = await transaction
          .select({ total: count() })
          .from(contactIdentities)
          .where(
            and(
              eq(contactIdentities.userId, input.userId),
              eq(contactIdentities.kind, input.kind),
            ),
          );
        if ((held?.total ?? 0) >= input.maximumAddresses)
          return { kind: "limit-reached" };
        await transaction.insert(contactIdentities).values({
          createdAt: input.now,
          id: createUuidV7(),
          kind: input.kind,
          userId: input.userId,
          value: input.destination,
          verifiedAt: input.now,
        });
        await replaceSessions(transaction, input, "email-linked");
        return { kind: "linked" };
      }),

    unlink: (input) =>
      database.transaction(async (transaction) => {
        await lock(transaction, input.userId);
        if (!(await lockActiveSession(transaction, input)))
          return { kind: "session-not-recent" };
        const outcome = removalOutcome(
          await listMethods(transaction, input.userId),
          { id: input.destination, kind: input.kind },
        );
        if (outcome !== "ok") return { kind: outcome };
        // The account is already known to hold it (checked above, under the account's lock); the filter is kept so this delete can never
        // touch another account's address.
        const [removed] = await transaction
          .delete(contactIdentities)
          .where(
            and(
              eq(contactIdentities.userId, input.userId),
              eq(contactIdentities.kind, input.kind),
              eq(contactIdentities.value, input.destination),
            ),
          )
          .returning({ id: contactIdentities.id });
        if (removed === undefined) return { kind: "missing" };
        await replaceSessions(transaction, input, "email-unlinked");
        return { kind: "unlinked" };
      }),
  };
}
