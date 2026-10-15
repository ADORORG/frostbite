import type { WalletAuthConfig } from "../../src/wallet-config.ts";

export const walletConfig: WalletAuthConfig = {
  balanceRefreshMs: 60_000,
  candidates: [
    { id: "xverse", label: "Xverse" },
    { id: "unisat", label: "UniSat" },
  ],
  challengeLifetimeMs: 300_000,
  maximumVerificationAttempts: 3,
  network: "signet",
  reconnectWaitMs: 10_000,
  releaseHoldMs: 86_400_000,
};
