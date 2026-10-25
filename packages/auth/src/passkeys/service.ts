import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import type { CorrelationId } from "@ador/shared/http";

import type { ActiveSession } from "../application/session-repository.ts";
import { createSessionMaterial } from "../application/session-material.ts";
import { createOpaqueValue, sha256 } from "../domain/crypto.ts";
import type {
  PasskeyLinkFailure,
  PasskeyPolicy,
  PasskeyRegistrationAdapter,
  PasskeyRegistrationPayload,
} from "./contracts.ts";
import { assertValidPasskeyPolicy } from "./policy.ts";
import type { PasskeyRepository } from "./repository.ts";

const CHALLENGE_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;

export function createPasskeyLinkingService(dependencies: {
  readonly adapter: PasskeyRegistrationAdapter;
  readonly clock: () => Date;
  readonly policy: PasskeyPolicy;
  readonly repository: PasskeyRepository;
}) {
  const { adapter, clock, policy, repository } = dependencies;
  assertValidPasskeyPolicy(policy);
  if (policy.recentAuthenticationWindowMs <= 0)
    throw new Error("Passkey policy is invalid");
  const isRecent = (session: ActiveSession, now: Date) => {
    const authenticationAgeMs =
      now.getTime() - session.authenticatedAt.getTime();
    return (
      authenticationAgeMs >= 0 &&
      authenticationAgeMs <= policy.recentAuthenticationWindowMs
    );
  };
  return {
    async list(userId: UuidV7) {
      return repository.listCredentialIds(userId);
    },
    async begin(input: {
      readonly session: ActiveSession;
      readonly userName: string;
    }) {
      const now = clock();
      if (!isRecent(input.session, now)) return null;
      const challenge = createOpaqueValue(CHALLENGE_BYTES);
      const stored = {
        challengeHash: sha256(challenge),
        challengeId: createUuidV7(),
        consumedAt: null,
        expiresAt: new Date(now.getTime() + policy.challengeLifetimeMs),
        issuedAt: now,
        origin: policy.expectedOrigin,
        relyingPartyId: policy.relyingPartyId,
        sessionId: input.session.sessionId,
        userId: input.session.userId,
      };
      await repository.issueChallenge(stored);
      return {
        challengeId: stored.challengeId,
        expiresAt: stored.expiresAt,
        options: await adapter.createOptions({
          challenge,
          existingCredentialIds: await repository.listCredentialIds(
            input.session.userId,
          ),
          relyingPartyId: policy.relyingPartyId,
          relyingPartyName: policy.relyingPartyName,
          userId: input.session.userId,
          userName: input.userName,
        }),
      };
    },
    async finish(input: {
      readonly challengeId: UuidV7;
      readonly correlationId: CorrelationId;
      readonly payload: PasskeyRegistrationPayload;
      readonly session: ActiveSession;
    }): Promise<
      | { readonly ok: true; readonly sessionToken: string }
      | { readonly ok: false; readonly code: PasskeyLinkFailure }
    > {
      const challenge = await repository.findChallenge(input.challengeId);
      if (
        !challenge ||
        challenge.userId !== input.session.userId ||
        challenge.sessionId !== input.session.sessionId
      )
        return { ok: false, code: "challenge-invalid" };
      if (challenge.consumedAt)
        return { ok: false, code: "challenge-replayed" };
      const now = clock();
      if (challenge.expiresAt <= now)
        return { ok: false, code: "challenge-expired" };
      if (!isRecent(input.session, now))
        return { ok: false, code: "recent-authentication-required" };
      const credential = await adapter.verify({
        challengeHash: challenge.challengeHash,
        expectedOrigin: challenge.origin,
        payload: input.payload,
        relyingPartyId: challenge.relyingPartyId,
      });
      if (!credential) return { ok: false, code: "challenge-invalid" };
      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await repository.completeLink({
        challenge,
        credential,
        correlationId: input.correlationId,
        minimumAuthenticatedAt: new Date(
          now.getTime() - policy.recentAuthenticationWindowMs,
        ),
        now,
        replacementSession: createSessionMaterial(now, sessionToken, policy),
      });
      if (result.kind === "conflict")
        return { ok: false, code: "credential-conflict" };
      if (result.kind !== "linked")
        return {
          ok: false,
          code:
            result.kind === "replayed"
              ? "challenge-replayed"
              : "challenge-invalid",
        };
      return { ok: true, sessionToken };
    },
    async unlink(input: {
      readonly credentialId: string;
      readonly correlationId: CorrelationId;
      readonly session: ActiveSession;
    }) {
      const now = clock();
      if (!isRecent(input.session, now))
        return { ok: false, code: "recent-authentication-required" } as const;
      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await repository.unlink({
        credentialId: input.credentialId,
        correlationId: input.correlationId,
        minimumAuthenticatedAt: new Date(
          now.getTime() - policy.recentAuthenticationWindowMs,
        ),
        now,
        replacementSession: createSessionMaterial(now, sessionToken, policy),
        sessionId: input.session.sessionId,
        userId: input.session.userId,
      });
      if (result.kind !== "unlinked")
        return { ok: false, code: result.kind } as const;
      return { ok: true, sessionToken } as const;
    },
  };
}
