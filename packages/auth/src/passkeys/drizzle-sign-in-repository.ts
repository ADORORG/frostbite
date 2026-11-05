import type { DatabaseClient } from "@frostbite/database/connection";
import {
  authSessions,
  passkeyCredentials,
} from "@frostbite/database/schema/auth";
import { passkeySignInChallenges } from "@frostbite/database/schema/passkey-sign-in";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { authenticatorTransportSchema } from "./contracts.ts";
import type { PasskeySignInRepository } from "./sign-in-repository.ts";

export function createDrizzlePasskeySignInRepository(
  database: DatabaseClient,
): PasskeySignInRepository {
  return {
    async issueChallenge(challenge) {
      await database.insert(passkeySignInChallenges).values({
        challengeHash: challenge.challengeHash,
        expiresAt: challenge.expiresAt,
        id: challenge.challengeId,
        issuedAt: challenge.issuedAt,
        origin: challenge.origin,
        relyingPartyId: challenge.relyingPartyId,
      });
    },

    async consumeChallenge(challengeId, now) {
      // One statement decides who gets the challenge: of any number of attempts at once, exactly one updates the row.
      const [row] = await database
        .update(passkeySignInChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(passkeySignInChallenges.id, challengeId),
            isNull(passkeySignInChallenges.consumedAt),
            gt(passkeySignInChallenges.expiresAt, now),
          ),
        )
        .returning();
      return row === undefined
        ? null
        : {
            challengeHash: row.challengeHash,
            challengeId,
            expiresAt: row.expiresAt,
            issuedAt: row.issuedAt,
            origin: row.origin,
            relyingPartyId: row.relyingPartyId,
          };
    },

    async findCredential(credentialId) {
      const [row] = await database
        .select()
        .from(passkeyCredentials)
        .where(eq(passkeyCredentials.credentialId, credentialId))
        .limit(1);
      return row === undefined
        ? null
        : {
            counter: row.counter,
            credentialId: row.credentialId,
            publicKey: new Uint8Array(row.publicKey),
            transports: row.transports.flatMap((transport) => {
              const parsed = authenticatorTransportSchema.safeParse(transport);
              return parsed.success ? [parsed.data] : [];
            }),
            userId: row.userId,
          };
    },

    completeSignIn: (input) =>
      database.transaction(async (transaction) => {
        // The counter is the guard against a cloned authenticator: the update applies only if nobody moved it since it was read.
        const [credential] = await transaction
          .update(passkeyCredentials)
          .set({ counter: input.newCounter, updatedAt: input.now })
          .where(
            and(
              eq(passkeyCredentials.credentialId, input.credentialId),
              eq(passkeyCredentials.counter, input.expectedCounter),
            ),
          )
          .returning({ userId: passkeyCredentials.userId });
        if (credential === undefined) return { kind: "conflict" };
        await transaction.insert(authSessions).values({
          ...input.session,
          id: createUuidV7(),
          userId: credential.userId,
        });
        return { kind: "signed-in", userId: credential.userId };
      }),
  };
}
