import {
  validateBitcoinAddress,
  type BitcoinNetwork,
  type ValidatedBitcoinAddress,
} from "@ador/chain/bitcoin";
import {
  createUuidV7,
  uuidV7Schema,
  type UuidV7,
} from "@ador/shared/identifiers";
import {
  walletQualificationMaximumAttemptsLimit,
  type QualificationBegin,
  type QualificationChallenge,
  type QualificationVerify,
} from "@ador/shared/wallet-qualification";
import type { WalletSignatureVerifier } from "../domain/contracts.ts";
import { createOpaqueValue, sha256 } from "../domain/crypto.ts";

export interface QualificationStoredChallenge {
  readonly id: UuidV7;
  readonly address: string;
  readonly origin: string;
  readonly messageHash: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}
export interface QualificationRepository {
  issue(challenge: QualificationStoredChallenge): Promise<void>;
  find(
    id: QualificationStoredChallenge["id"],
  ): Promise<QualificationStoredChallenge | null>;
  settle(
    id: QualificationStoredChallenge["id"],
    passed: boolean,
    clock: () => Date,
    maximumAttempts: number,
  ): Promise<boolean>;
}
export interface QualificationPolicy {
  readonly origin: string;
  readonly network: BitcoinNetwork;
  readonly providers: readonly string[];
  readonly lifetimeMs: number;
  readonly maximumAttempts: number;
}

export function createWalletQualificationService(dependencies: {
  readonly clock: () => Date;
  readonly policy: QualificationPolicy;
  readonly repository: QualificationRepository;
  readonly verifier: WalletSignatureVerifier;
}) {
  const { policy, repository, verifier, clock } = dependencies;
  const origin = new URL(policy.origin);
  if (
    origin.origin !== policy.origin ||
    !["http:", "https:"].includes(origin.protocol) ||
    !Number.isSafeInteger(policy.lifetimeMs) ||
    policy.lifetimeMs <= 0 ||
    !Number.isSafeInteger(policy.maximumAttempts) ||
    policy.maximumAttempts <= 0 ||
    policy.maximumAttempts > walletQualificationMaximumAttemptsLimit ||
    policy.providers.length === 0 ||
    new Set(policy.providers).size !== policy.providers.length
  ) {
    throw new Error("Invalid wallet qualification policy.");
  }
  return {
    async begin(
      input: QualificationBegin,
    ): Promise<QualificationChallenge | null> {
      const validated = validateBitcoinAddress(input.address, policy.network);
      if (
        !validated.ok ||
        input.network !== policy.network ||
        !policy.providers.includes(input.provider)
      )
        return null;
      const now = clock();
      const expiresAt = new Date(now.getTime() + policy.lifetimeMs);
      const id = createUuidV7();
      const message = [
        `${origin.hostname} requests a wallet integration test signature.`,
        "This is qualification only. It does not sign you in, create a session, or create or broadcast a transaction.",
        `Origin: ${policy.origin}`,
        `Address: ${validated.value.address}`,
        `Network: ${policy.network}`,
        `Provider candidate: ${input.provider}`,
        "Purpose: wallet-message-qualification-v1",
        "Signature Scheme: bip322-simple",
        `Challenge ID: ${id}`,
        `Nonce: ${createOpaqueValue(32)}`,
        `Issued At: ${now.toISOString()}`,
        `Expires At: ${expiresAt.toISOString()}`,
      ].join("\n");
      await repository.issue({
        id,
        address: validated.value.address,
        origin: policy.origin,
        messageHash: sha256(message),
        attempts: 0,
        expiresAt,
        consumedAt: null,
      });
      return {
        challengeId: id,
        expiresAt: expiresAt.toISOString(),
        message,
        signatureScheme: "bip322-simple",
      };
    },
    async verify(input: QualificationVerify): Promise<boolean> {
      const id = uuidV7Schema.safeParse(input.challengeId);
      if (!id.success) return false;
      const stored = await repository.find(id.data);
      const now = clock();
      if (
        !stored ||
        stored.origin !== policy.origin ||
        stored.consumedAt !== null ||
        stored.expiresAt <= now ||
        stored.attempts >= policy.maximumAttempts
      )
        return false;
      const address = validateBitcoinAddress(stored.address, policy.network);
      const passed =
        address.ok &&
        sha256(input.message) === stored.messageHash &&
        verifySignature(address.value.address, input.message, input.signature);
      const settled = await repository.settle(
        stored.id,
        passed,
        clock,
        policy.maximumAttempts,
      );
      return passed && settled;
    },
  };
  function verifySignature(
    address: ValidatedBitcoinAddress,
    message: string,
    signature: string,
  ): boolean {
    return verifier.verify({ address, message, signature });
  }
}
