import { validateBitcoinAddress } from "@frostbite/chain/bitcoin";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import type {
  ConsumeChallengeResult,
  StoredWalletChallenge,
} from "../src/application/repository.ts";
import { createWalletAuthService } from "../src/application/service.ts";
import { sha256 } from "../src/domain/crypto.ts";
import { serializeWalletChallenge } from "../src/domain/serialize-challenge.ts";

const now = new Date("2026-09-08T12:00:00.000Z");
const validated = validateBitcoinAddress(
  "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v",
  "signet",
);
if (!validated.ok) throw new Error("Expected valid fixture address");
const fixtureAddress = validated.value;

function storedChallenge(): StoredWalletChallenge {
  const base: StoredWalletChallenge = {
    action: "sign-in",
    address: fixtureAddress.address,
    attempts: 0,
    challengeId: createUuidV7(),
    consumedAt: null,
    domain: "launch.example",
    expectedUserId: null,
    expiresAt: new Date(now.getTime() + 60_000),
    issuedAt: now,
    messageHash: "",
    network: "signet",
    nonce: "fixture-nonce",
    origin: "https://launch.example",
    requestId: createUuidV7(),
    scriptIdentity: fixtureAddress.scriptHex,
    uri: "https://launch.example/auth/wallet",
    walletAdapter: "lasereyes",
  };
  const message = serializeWalletChallenge({
    ...base,
    schemaVersion: 1,
    signatureScheme: "bip322-simple",
  });
  return { ...base, messageHash: sha256(message) };
}

describe("transaction outcome mapping", () => {
  it.each([
    ["expired", "challenge-expired"],
    ["invalid", "challenge-invalid"],
  ] as const)("maps %s without issuing a session", async (kind, code) => {
    const challenge = storedChallenge();
    const service = createWalletAuthService({
      clock: () => now,
      policy: {
        challengeLifetimeMs: 60_000,
        maximumVerificationAttempts: 2,
        sessionAbsoluteLifetimeMs: 2_000,
        sessionIdleLifetimeMs: 1_000,
      },
      repository: {
        consumeChallenge: async (): Promise<ConsumeChallengeResult> => ({
          kind,
        }),
        findChallenge: async () => challenge,
        incrementFailedAttempt: async () => undefined,
        issueChallenge: async () => undefined,
      },
      verifier: { verify: () => true },
    });
    await expect(
      service.verify({
        expectedAction: "sign-in",
        challengeId: challenge.challengeId,
        signature: "fixture",
      }),
    ).resolves.toEqual({ code, ok: false });
  });
});
