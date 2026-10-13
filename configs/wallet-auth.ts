import type { WalletAuthConfig } from "@ador/feature-accounts";

// How wallet sign-in behaves, as the business decided it. A change is a reviewed change to this record.
export const walletAuthConfig = {
  // A challenge can be signed for five minutes.
  challengeLifetimeMs: 300_000,
  // Three wrong signatures kill a challenge, so a guess at a signature is not worth making.
  maximumVerificationAttempts: 3,
  // A wallet an account removed cannot be taken by another account for 24 hours (owner decision, 2026-10-13).
  releaseHoldMs: 86_400_000,
} as const satisfies WalletAuthConfig;
