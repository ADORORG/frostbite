import { createUuidV7, type UuidV7 } from "@frostbite/shared/identifiers";

import { createSessionMaterial } from "../application/session-material.ts";
import { createOpaqueValue, sha256 } from "../domain/crypto.ts";
import type { PasskeyPolicy } from "./contracts.ts";
import { assertValidPasskeyPolicy } from "./policy.ts";
import type {
  PasskeyAuthenticationAdapter,
  PasskeyAuthenticationPayload,
  PasskeySignInFailure,
} from "./sign-in-contracts.ts";
import type { PasskeySignInRepository } from "./sign-in-repository.ts";

const CHALLENGE_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;

export type PasskeySignInPolicy = Pick<
  PasskeyPolicy,
  | "challengeLifetimeMs"
  | "expectedOrigin"
  | "relyingPartyId"
  | "sessionAbsoluteLifetimeMs"
  | "sessionIdleLifetimeMs"
>;

// Signing in with a passkey. Nothing here depends on who is asking: the challenge belongs to no one, the account is found from the
// credential that signs it, and every way it can fail looks the same to the caller (`PasskeySignInFailure` is for the log).
export function createPasskeySignInService(dependencies: {
  readonly adapter: PasskeyAuthenticationAdapter;
  readonly clock: () => Date;
  readonly policy: PasskeySignInPolicy;
  readonly repository: PasskeySignInRepository;
}) {
  const { adapter, clock, policy, repository } = dependencies;
  assertValidPasskeyPolicy(policy);
  return {
    async begin() {
      const now = clock();
      const challenge = createOpaqueValue(CHALLENGE_BYTES);
      const stored = {
        challengeHash: sha256(challenge),
        challengeId: createUuidV7(),
        expiresAt: new Date(now.getTime() + policy.challengeLifetimeMs),
        issuedAt: now,
        origin: policy.expectedOrigin,
        relyingPartyId: policy.relyingPartyId,
      };
      await repository.issueChallenge(stored);
      return {
        challengeId: stored.challengeId,
        expiresAt: stored.expiresAt,
        options: await adapter.createOptions({
          challenge,
          relyingPartyId: policy.relyingPartyId,
        }),
      };
    },

    async finish(input: {
      readonly challengeId: UuidV7;
      readonly payload: PasskeyAuthenticationPayload;
    }): Promise<
      | { readonly ok: true; readonly sessionToken: string }
      | { readonly ok: false; readonly code: PasskeySignInFailure }
    > {
      const now = clock();
      // The challenge is spent before anything else is checked: one attempt each, so a stolen or guessed response cannot be tried
      // again, and a response that fails wastes its challenge.
      const challenge = await repository.consumeChallenge(
        input.challengeId,
        now,
      );
      if (challenge === null) return { ok: false, code: "challenge-invalid" };
      const { payload } = input;
      const credential = await repository.findCredential(payload.id);
      if (credential === null) return { ok: false, code: "credential-unknown" };
      const verified =
        payload.id === payload.rawId
          ? await adapter.verify({
              challengeHash: challenge.challengeHash,
              credential,
              expectedOrigin: challenge.origin,
              payload,
              relyingPartyId: challenge.relyingPartyId,
            })
          : null;
      if (verified === null) return { ok: false, code: "not-verified" };
      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await repository.completeSignIn({
        credentialId: credential.credentialId,
        expectedCounter: credential.counter,
        newCounter: verified.counter,
        now,
        session: createSessionMaterial(now, sessionToken, policy),
      });
      return result.kind === "signed-in"
        ? { ok: true, sessionToken }
        : { ok: false, code: "counter-conflict" };
    },
  };
}

export type PasskeySignInService = ReturnType<
  typeof createPasskeySignInService
>;
