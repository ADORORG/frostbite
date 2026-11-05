import { validateBitcoinAddress } from "@frostbite/chain/bitcoin";
import { createUuidV7 } from "@frostbite/shared/identifiers";

import type {
  IssueWalletChallengeInput,
  IssuedWalletChallenge,
  VerifyWalletChallengeInput,
  WalletAuthenticationResult,
  WalletAuthPolicy,
  WalletChallengeMessage,
  WalletSignatureVerifier,
} from "../domain/contracts.ts";
import {
  BIP322_SIGNATURE_SCHEME,
  WALLET_CHALLENGE_SCHEMA_VERSION,
} from "../domain/contracts.ts";
import { createOpaqueValue, sha256 } from "../domain/crypto.ts";
import { serializeWalletChallenge } from "../domain/serialize-challenge.ts";
import type {
  StoredWalletChallenge,
  WalletAuthRepository,
} from "./repository.ts";

const NONCE_BYTES = 32;
const SESSION_TOKEN_BYTES = 32;

function parseRequestLocation(origin: string, uri: string): URL | null {
  try {
    const parsedOrigin = new URL(origin);
    const parsedUri = new URL(uri);
    const supportedProtocol =
      parsedOrigin.protocol === "https:" || parsedOrigin.protocol === "http:";
    if (
      !supportedProtocol ||
      parsedOrigin.origin !== origin ||
      parsedUri.origin !== parsedOrigin.origin
    ) {
      return null;
    }
    return parsedUri;
  } catch {
    return null;
  }
}

function toMessage(challenge: StoredWalletChallenge): WalletChallengeMessage {
  return {
    action: challenge.action,
    address: challenge.address,
    challengeId: challenge.challengeId,
    domain: challenge.domain,
    expiresAt: challenge.expiresAt,
    issuedAt: challenge.issuedAt,
    network: challenge.network,
    nonce: challenge.nonce,
    origin: challenge.origin,
    requestId: challenge.requestId,
    schemaVersion: WALLET_CHALLENGE_SCHEMA_VERSION,
    signatureScheme: BIP322_SIGNATURE_SCHEME,
    uri: challenge.uri,
  };
}

const conflictCodes = {
  held: "wallet-held",
  "not-on-account": "wallet-not-on-account",
  "other-account": "wallet-on-another-account",
  unusable: "identity-conflict",
} as const;

export function createWalletAuthService(dependencies: {
  readonly clock: () => Date;
  readonly policy: WalletAuthPolicy;
  readonly repository: WalletAuthRepository;
  readonly verifier: WalletSignatureVerifier;
}) {
  if (
    dependencies.policy.challengeLifetimeMs <= 0 ||
    dependencies.policy.maximumVerificationAttempts <= 0 ||
    dependencies.policy.sessionIdleLifetimeMs <= 0 ||
    dependencies.policy.sessionAbsoluteLifetimeMs <
      dependencies.policy.sessionIdleLifetimeMs
  )
    throw new Error("Wallet authentication policy is invalid");
  return {
    async issue(
      input: IssueWalletChallengeInput,
    ): Promise<IssuedWalletChallenge | null> {
      const location = parseRequestLocation(input.origin, input.uri);
      const validated = validateBitcoinAddress(input.address, input.network);
      const requiresUser =
        input.action === "link-wallet" || input.action === "step-up";
      if (
        location === null ||
        !validated.ok ||
        input.walletAdapter.length === 0 ||
        input.walletAdapter !== input.walletAdapter.trim() ||
        (requiresUser && input.expectedUserId === undefined) ||
        (input.action === "sign-in" && input.expectedUserId !== undefined)
      )
        return null;

      const issuedAt = dependencies.clock();
      const challenge: StoredWalletChallenge = {
        action: input.action,
        address: validated.value.address,
        attempts: 0,
        challengeId: createUuidV7(),
        consumedAt: null,
        domain: location.hostname,
        expectedUserId: input.expectedUserId ?? null,
        expiresAt: new Date(
          issuedAt.getTime() + dependencies.policy.challengeLifetimeMs,
        ),
        issuedAt,
        messageHash: "",
        network: input.network,
        nonce: createOpaqueValue(NONCE_BYTES),
        origin: input.origin,
        requestId: input.requestId,
        scriptIdentity: validated.value.scriptHex,
        uri: input.uri,
        walletAdapter: input.walletAdapter,
      };
      const message = serializeWalletChallenge(toMessage(challenge));
      const persisted = { ...challenge, messageHash: sha256(message) };
      await dependencies.repository.issueChallenge(persisted);
      return {
        challengeId: persisted.challengeId,
        expiresAt: persisted.expiresAt,
        message,
        signatureScheme: BIP322_SIGNATURE_SCHEME,
      };
    },

    async verify(
      input: VerifyWalletChallengeInput,
    ): Promise<WalletAuthenticationResult> {
      const challenge = await dependencies.repository.findChallenge(
        input.challengeId,
      );
      if (challenge === null) return { code: "challenge-invalid", ok: false };
      if (
        challenge.action !== input.expectedAction ||
        challenge.expectedUserId !== (input.expectedUserId ?? null)
      )
        return { code: "challenge-invalid", ok: false };
      if (challenge.consumedAt !== null)
        return { code: "challenge-replayed", ok: false };
      const now = dependencies.clock();
      if (challenge.expiresAt <= now)
        return { code: "challenge-expired", ok: false };
      if (
        challenge.attempts >= dependencies.policy.maximumVerificationAttempts
      ) {
        return { code: "challenge-invalid", ok: false };
      }
      const message = serializeWalletChallenge(toMessage(challenge));
      if (sha256(message) !== challenge.messageHash) {
        return { code: "challenge-invalid", ok: false };
      }
      if (
        !dependencies.verifier.verify({
          address: challenge.address,
          message,
          signature: input.signature,
        })
      ) {
        await dependencies.repository.incrementFailedAttempt(
          challenge.challengeId,
          dependencies.policy.maximumVerificationAttempts,
        );
        return { code: "signature-invalid", ok: false };
      }

      const sessionToken = createOpaqueValue(SESSION_TOKEN_BYTES);
      const result = await dependencies.repository.consumeChallenge(
        challenge,
        {
          absoluteExpiresAt: new Date(
            now.getTime() + dependencies.policy.sessionAbsoluteLifetimeMs,
          ),
          authenticatedAt: now,
          idleExpiresAt: new Date(
            now.getTime() + dependencies.policy.sessionIdleLifetimeMs,
          ),
          tokenHash: sha256(sessionToken),
        },
        now,
        dependencies.policy.maximumVerificationAttempts,
      );
      // Reached only once the signature has verified, so only whoever holds the wallet's key is told why it cannot be used.
      if (result.kind === "identity-conflict")
        return { code: conflictCodes[result.reason], ok: false };
      if (result.kind === "expired")
        return { code: "challenge-expired", ok: false };
      if (result.kind === "invalid")
        return { code: "challenge-invalid", ok: false };
      if (result.kind === "unavailable")
        return { code: "challenge-replayed", ok: false };
      return { ok: true, sessionToken, userId: result.userId };
    },
  };
}
