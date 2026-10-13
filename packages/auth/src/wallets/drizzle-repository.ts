import type { DatabaseClient } from "@ador/database/connection";
import {
  authSecurityEvents,
  authSessions,
  walletIdentities,
} from "@ador/database/schema/auth";
import { releasedWallets } from "@ador/database/schema/wallet-release";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { and, eq, isNull, sql } from "drizzle-orm";

import { lockActiveSession } from "../adapters/lock-active-session.ts";
import { sha256 } from "../domain/crypto.ts";
import { listAccountMethods } from "../methods/drizzle-account-methods.ts";
import { removalOutcome } from "../methods/rule.ts";
import type { WalletMethodsRepository } from "./repository.ts";

export function createDrizzleWalletMethodsRepository(
  database: DatabaseClient,
): WalletMethodsRepository {
  return {
    async list(userId) {
      const rows = await database
        .select()
        .from(walletIdentities)
        .where(eq(walletIdentities.userId, userId))
        .orderBy(walletIdentities.createdAt, walletIdentities.id);
      return rows.map((row) => ({
        address: row.address,
        id: uuidV7Schema.parse(row.id),
        linkedAt: row.createdAt,
        network: row.network === "mainnet" ? "mainnet" : "signet",
        walletAdapter: row.walletAdapter,
      }));
    },
    unlink: (input) =>
      database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`,
        );
        // A session that may no longer make the change finds nothing to remove: the same answer as a missing wallet.
        if (!(await lockActiveSession(transaction, input)))
          return { kind: "missing" };
        const outcome = removalOutcome(
          await listAccountMethods(transaction, input.userId),
          { id: input.walletId, kind: "wallet" },
        );
        if (outcome !== "ok") return { kind: outcome };
        const [wallet] = await transaction
          .delete(walletIdentities)
          .where(
            and(
              eq(walletIdentities.id, input.walletId),
              eq(walletIdentities.userId, input.userId),
            ),
          )
          .returning();
        if (wallet === undefined) return { kind: "missing" };
        await transaction
          .insert(releasedWallets)
          .values({
            heldUntil: input.heldUntil,
            id: createUuidV7(),
            network: wallet.network,
            previousUserId: input.userId,
            releasedAt: input.now,
            scriptIdentity: wallet.scriptIdentity,
          })
          .onConflictDoUpdate({
            set: {
              heldUntil: input.heldUntil,
              previousUserId: input.userId,
              releasedAt: input.now,
            },
            target: [releasedWallets.network, releasedWallets.scriptIdentity],
          });
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
          action: "wallet-unlinked",
          actorUserId: input.userId,
          correlationId: input.correlationId,
          credentialFingerprint: sha256(wallet.scriptIdentity),
          id: createUuidV7(),
          sessionId: replacementId,
        });
        return { kind: "unlinked" };
      }),
  };
}
