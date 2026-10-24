import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import {
  authSecurityEvents,
  authSessions,
  passkeyChallenges,
  passkeyCredentials,
} from "@ador/database/schema/auth";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { and, eq, isNull, sql } from "drizzle-orm";

import { lockActiveSession } from "../adapters/lock-active-session.ts";
import { sha256 } from "../domain/crypto.ts";
import type { ListMethods } from "../methods/contracts.ts";
import { removalOutcome } from "../methods/rule.ts";
import { passkeyMethodKind } from "./method.ts";
import type { PasskeyRepository } from "./repository.ts";

// `listMethods` is the method registry's: whether a passkey may be removed depends on every method the account has.
export function createDrizzlePasskeyRepository(
  database: DatabaseClient,
  listMethods: ListMethods<DatabaseTransaction>,
): PasskeyRepository {
  return {
    async issueChallenge(challenge) {
      await database.insert(passkeyChallenges).values({
        challengeHash: challenge.challengeHash,
        consumedAt: challenge.consumedAt,
        expiresAt: challenge.expiresAt,
        issuedAt: challenge.issuedAt,
        id: challenge.challengeId,
        origin: challenge.origin,
        relyingPartyId: challenge.relyingPartyId,
        sessionId: challenge.sessionId,
        userId: challenge.userId,
      });
    },
    async findChallenge(challengeId) {
      const [row] = await database
        .select()
        .from(passkeyChallenges)
        .where(eq(passkeyChallenges.id, challengeId))
        .limit(1);
      return row
        ? {
            challengeHash: row.challengeHash,
            challengeId: uuidV7Schema.parse(row.id),
            consumedAt: row.consumedAt,
            expiresAt: row.expiresAt,
            issuedAt: row.issuedAt,
            origin: row.origin,
            relyingPartyId: row.relyingPartyId,
            sessionId: uuidV7Schema.parse(row.sessionId),
            userId: uuidV7Schema.parse(row.userId),
          }
        : null;
    },
    async listCredentialIds(userId) {
      const rows = await database
        .select({ credentialId: passkeyCredentials.credentialId })
        .from(passkeyCredentials)
        .where(eq(passkeyCredentials.userId, userId));
      return rows.map(({ credentialId }) => credentialId);
    },
    async completeLink({
      challenge,
      credential,
      correlationId,
      minimumAuthenticatedAt,
      now,
      replacementSession,
    }) {
      return database.transaction(async (transaction) => {
        const [locked] = await transaction
          .select()
          .from(passkeyChallenges)
          .where(eq(passkeyChallenges.id, challenge.challengeId))
          .for("update")
          .limit(1);
        if (!locked || locked.consumedAt) return { kind: "replayed" };
        if (
          locked.userId !== challenge.userId ||
          locked.sessionId !== challenge.sessionId ||
          locked.challengeHash !== challenge.challengeHash ||
          locked.issuedAt.getTime() !== challenge.issuedAt.getTime() ||
          locked.origin !== challenge.origin ||
          locked.relyingPartyId !== challenge.relyingPartyId ||
          locked.expiresAt.getTime() !== challenge.expiresAt.getTime() ||
          locked.expiresAt <= now
        )
          return { kind: "invalid" };
        if (
          !(await lockActiveSession(transaction, {
            minimumAuthenticatedAt,
            now,
            sessionId: challenge.sessionId,
            userId: challenge.userId,
          }))
        )
          return { kind: "invalid" };
        await transaction
          .update(passkeyChallenges)
          .set({ consumedAt: now })
          .where(eq(passkeyChallenges.id, challenge.challengeId));
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${credential.credentialId}, 0))`,
        );
        const [existing] = await transaction
          .select({ userId: passkeyCredentials.userId })
          .from(passkeyCredentials)
          .where(eq(passkeyCredentials.credentialId, credential.credentialId))
          .limit(1);
        if (existing) return { kind: "conflict" };
        await transaction.insert(passkeyCredentials).values({
          backedUp: credential.backedUp,
          counter: credential.counter,
          credentialId: credential.credentialId,
          deviceType: credential.deviceType,
          id: createUuidV7(),
          publicKey: Buffer.from(credential.publicKey),
          transports: [...credential.transports],
          userId: challenge.userId,
        });
        await transaction
          .update(authSessions)
          .set({ revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(authSessions.userId, challenge.userId),
              isNull(authSessions.revokedAt),
            ),
          );
        await transaction.insert(authSessions).values({
          ...replacementSession,
          id: createUuidV7(),
          userId: challenge.userId,
        });
        await transaction.insert(authSecurityEvents).values({
          action: "passkey-linked",
          actorUserId: challenge.userId,
          correlationId,
          credentialFingerprint: sha256(credential.credentialId),
          id: createUuidV7(),
          sessionId: challenge.sessionId,
        });
        return { kind: "linked" };
      });
    },
    async unlink({
      credentialId,
      correlationId,
      minimumAuthenticatedAt,
      now,
      replacementSession,
      sessionId,
      userId,
    }) {
      return database.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
        );
        if (
          !(await lockActiveSession(transaction, {
            minimumAuthenticatedAt,
            now,
            sessionId,
            userId,
          }))
        )
          return { kind: "missing" };
        const [credential] = await transaction
          .select({ id: passkeyCredentials.id })
          .from(passkeyCredentials)
          .where(
            and(
              eq(passkeyCredentials.credentialId, credentialId),
              eq(passkeyCredentials.userId, userId),
            ),
          )
          .limit(1);
        if (!credential) return { kind: "missing" };
        // Whether the account would still have a way in is the shared rule's decision, on what it holds now.
        const outcome = removalOutcome(await listMethods(transaction, userId), {
          id: credentialId,
          kind: passkeyMethodKind,
        });
        if (outcome !== "ok") return { kind: outcome };
        await transaction
          .delete(passkeyCredentials)
          .where(eq(passkeyCredentials.id, credential.id));
        await transaction
          .update(authSessions)
          .set({ revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(authSessions.userId, userId),
              isNull(authSessions.revokedAt),
            ),
          );
        await transaction.insert(authSessions).values({
          ...replacementSession,
          id: createUuidV7(),
          userId,
        });
        await transaction.insert(authSecurityEvents).values({
          action: "passkey-unlinked",
          actorUserId: userId,
          correlationId,
          credentialFingerprint: sha256(credentialId),
          id: createUuidV7(),
          sessionId,
        });
        return { kind: "unlinked" };
      });
    },
  };
}
