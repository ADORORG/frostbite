import type { WalletAuthConfig } from "../../src/wallet-config.ts";

export const walletConfig: WalletAuthConfig = {
  candidates: [
    { id: "xverse", label: "Xverse" },
    { id: "unisat", label: "UniSat" },
  ],
  challengeLifetimeMs: 300_000,
  maximumVerificationAttempts: 3,
  network: "signet",
  releaseHoldMs: 86_400_000,
};
