import {
  authSecurityEvents,
  authSessions,
  authUsers,
  walletChallenges,
  walletIdentities,
  type WalletChallenge,
} from "@ador/database/schema/auth";
import { releasedWallets } from "@ador/database/schema/wallet-release";
import type {
  DatabaseClient,
  DatabaseTransaction,
} from "@ador/database/connection";
import {
  validateBitcoinAddress,
  type BitcoinNetwork,
} from "@ador/chain/bitcoin";
import {
  createUuidV7,
  uuidV7Schema,
  type UuidV7,
} from "@ador/shared/identifiers";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { sha256 } from "../domain/crypto.ts";
import {
  walletAuthActions,
  type WalletAuthAction,
} from "../domain/contracts.ts";
import type {
  ConsumeChallengeResult,
  StoredWalletChallenge,
  WalletAuthRepository,
} from "../application/repository.ts";

const WALLET_USER_NAME = "Bitcoin wallet user";

function isNetwork(value: string): value is BitcoinNetwork {
  return value === "mainnet" || value === "signet";
}

function isAction(value: string): value is WalletAuthAction {
  return walletAuthActions.some((action) => action === value);
}

function mapChallenge(row: WalletChallenge): StoredWalletChallenge | null {
  if (!isNetwork(row.network) || !isAction(row.action)) return null;
  const address = validateBitcoinAddress(row.address, row.network);
  const challengeId = uuidV7Schema.safeParse(row.id);
  const requestId = uuidV7Schema.safeParse(row.requestId);
  const expectedUserId =
    row.expectedUserId === null
      ? null
      : uuidV7Schema.safeParse(row.expectedUserId);
  if (!address.ok || !challengeId.success || !requestId.success) return null;
  if (expectedUserId !== null && !expectedUserId.success) return null;
  return {
    action: row.action,
    address: address.value.address,
    attempts: row.attempts,
    challengeId: challengeId.data,
    consumedAt: row.consumedAt,
    domain: row.domain,
    expectedUserId: expectedUserId?.data ?? null,
    expiresAt: row.expiresAt,
    issuedAt: row.issuedAt,
    messageHash: row.messageHash,
    network: row.network,
    nonce: row.nonce,
    origin: row.origin,
    requestId: requestId.data,
    scriptIdentity: row.scriptIdentity,
    uri: row.uri,
    walletAdapter: row.walletAdapter,
  };
}

function rowMatchesChallenge(
  row: WalletChallenge,
  challenge: StoredWalletChallenge,
): boolean {
  return (
    row.action === challenge.action &&
    row.address === challenge.address &&
    row.domain === challenge.domain &&
    row.expectedUserId === challenge.expectedUserId &&
    row.issuedAt.getTime() === challenge.issuedAt.getTime() &&
    row.messageHash === challenge.messageHash &&
    row.network === challenge.network &&
    row.nonce === challenge.nonce &&
    row.origin === challenge.origin &&
    row.requestId === challenge.requestId &&
    row.scriptIdentity === challenge.scriptIdentity &&
    row.uri === challenge.uri &&
    row.walletAdapter === challenge.walletAdapter
  );
}

async function resolveUser(
  transaction: DatabaseTransaction,
  challenge: StoredWalletChallenge,
  now: Date,
): Promise<
  { readonly ok: true; readonly userId: UuidV7 } | { readonly ok: false }
> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${challenge.network}:${challenge.scriptIdentity}`}, 0))`,
  );
  const [identity] = await transaction
    .select({ userId: walletIdentities.userId })
    .from(walletIdentities)
    .where(
      and(
        eq(walletIdentities.network, challenge.network),
        eq(walletIdentities.scriptIdentity, challenge.scriptIdentity),
      ),
    )
    .limit(1);
  if (identity !== undefined) {
    const userId = uuidV7Schema.parse(identity.userId);
    return challenge.expectedUserId !== null &&
      challenge.expectedUserId !== userId
      ? { ok: false }
      : { ok: true, userId };
  }
  if (challenge.action === "step-up") return { ok: false };
  // A wallet an account removed is held for a while: only that account may take it back, and nobody may start a
  // new account with it. The refusal is the same one as any other conflict, so it says nothing about who had it.
  const [held] = await transaction
    .select({ previousUserId: releasedWallets.previousUserId })
    .from(releasedWallets)
    .where(
      and(
        eq(releasedWallets.network, challenge.network),
        eq(releasedWallets.scriptIdentity, challenge.scriptIdentity),
        sql`${releasedWallets.heldUntil} > ${now}`,
      ),
    )
    .limit(1);
  if (
    held !== undefined &&
    (challenge.action === "sign-in" ||
      challenge.expectedUserId !== held.previousUserId)
  )
    return { ok: false };
  if (challenge.action !== "sign-in" && challenge.expectedUserId === null) {
    return { ok: false };
  }
  const userId = challenge.expectedUserId ?? createUuidV7();
  if (challenge.expectedUserId !== null) {
    const [user] = await transaction
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, challenge.expectedUserId))
      .limit(1);
    if (user === undefined) return { ok: false };
  }
  if (challenge.expectedUserId === null) {
    await transaction.insert(authUsers).values({
      email: `wallet-${userId}@wallet.invalid`,
      id: userId,
      name: WALLET_USER_NAME,
    });
  }
  await transaction.insert(walletIdentities).values({
    address: challenge.address,
    id: createUuidV7(),
    network: challenge.network,
    scriptIdentity: challenge.scriptIdentity,
    userId,
    walletAdapter: challenge.walletAdapter,
  });
  return { ok: true, userId };
}

export function createDrizzleWalletAuthRepository(
  database: DatabaseClient,
): WalletAuthRepository {
  return {
    async findChallenge(challengeId) {
      const [row] = await database
        .select()
        .from(walletChallenges)
        .where(eq(walletChallenges.id, challengeId))
        .limit(1);
      return row === undefined ? null : mapChallenge(row);
    },
    async incrementFailedAttempt(challengeId, maximumAttempts) {
      await database
        .update(walletChallenges)
        .set({ attempts: sql`${walletChallenges.attempts} + 1` })
        .where(
          and(
            eq(walletChallenges.id, challengeId),
            isNull(walletChallenges.consumedAt),
            lt(walletChallenges.attempts, maximumAttempts),
          ),
        );
    },
    async issueChallenge(challenge) {
      await database.insert(walletChallenges).values({
        action: challenge.action,
        address: challenge.address,
        attempts: challenge.attempts,
        consumedAt: challenge.consumedAt,
        domain: challenge.domain,
        expectedUserId: challenge.expectedUserId,
        expiresAt: challenge.expiresAt,
        id: challenge.challengeId,
        issuedAt: challenge.issuedAt,
        messageHash: challenge.messageHash,
        network: challenge.network,
        nonce: challenge.nonce,
        origin: challenge.origin,
        requestId: challenge.requestId,
        schemaVersion: 1,
        scriptIdentity: challenge.scriptIdentity,
        signatureScheme: "bip322-simple",
        uri: challenge.uri,
        walletAdapter: challenge.walletAdapter,
      });
    },
    async consumeChallenge(
      challenge,
      session,
      now,
      maximumAttempts,
    ): Promise<ConsumeChallengeResult> {
      return database.transaction(async (transaction) => {
        const [locked] = await transaction
          .select()
          .from(walletChallenges)
          .where(eq(walletChallenges.id, challenge.challengeId))
          .for("update")
          .limit(1);
        if (locked === undefined || locked.consumedAt !== null)
          return { kind: "unavailable" };
        if (locked.expiresAt <= now) return { kind: "expired" };
        if (
          locked.attempts >= maximumAttempts ||
          !rowMatchesChallenge(locked, challenge)
        )
          return { kind: "invalid" };

        const user = await resolveUser(transaction, challenge, now);
        if (!user.ok) return { kind: "identity-conflict" };
        if (challenge.action !== "sign-in") {
          await transaction
            .update(authSessions)
            .set({ revokedAt: now, updatedAt: now })
            .where(
              and(
                eq(authSessions.userId, user.userId),
                isNull(authSessions.revokedAt),
              ),
            );
        }
        await transaction
          .update(walletChallenges)
          .set({ consumedAt: now })
          .where(eq(walletChallenges.id, challenge.challengeId));
        const sessionId = createUuidV7();
        await transaction.insert(authSessions).values({
          absoluteExpiresAt: session.absoluteExpiresAt,
          authenticatedAt: session.authenticatedAt,
          id: sessionId,
          idleExpiresAt: session.idleExpiresAt,
          tokenHash: session.tokenHash,
          userId: user.userId,
        });
        if (challenge.action === "link-wallet")
          await transaction.insert(authSecurityEvents).values({
            action: "wallet-linked",
            actorUserId: user.userId,
            correlationId: challenge.requestId,
            credentialFingerprint: sha256(challenge.scriptIdentity),
            id: createUuidV7(),
            sessionId,
          });
        return { kind: "consumed", userId: user.userId };
      });
    },
  };
}
