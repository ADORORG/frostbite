import {
  laserEyesProviderIds,
  type LaserEyesProviderId,
} from "@ador/wallet/conformance";
import type { WalletNetwork } from "@ador/wallet/contracts";

export interface WalletCandidate {
  readonly id: LaserEyesProviderId;
  readonly label: string;
}

// The platform's wallet sign-in settings: values that are the business's to decide, not the environment's.
// Supplied by the platform's configuration (`configs/wallet.ts`), so changing one is a reviewed change.
export interface WalletAuthConfig {
  // How often the widget refreshes the balance while its menu is open.
  readonly balanceRefreshMs: number;
  // The wallets a player can choose from, in the order the platform prefers (wallets detected in the browser are
  // listed first).
  readonly candidates: readonly WalletCandidate[];
  // How long a challenge can be signed before it lapses.
  readonly challengeLifetimeMs: number;
  // How many wrong signatures a challenge tolerates before it is dead.
  readonly maximumVerificationAttempts: number;
  // The network the wallet is asked to connect on.
  readonly network: WalletNetwork;
  // How long a wallet an account removed cannot be taken by another account.
  readonly releaseHoldMs: number;
}

// Refuses a setting that cannot work, when the platform starts, rather than when a player tries to sign in.
export function validateWalletAuthConfig(
  config: WalletAuthConfig,
): WalletAuthConfig {
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  if (
    !positive(config.balanceRefreshMs) ||
    !positive(config.challengeLifetimeMs) ||
    !positive(config.maximumVerificationAttempts) ||
    !positive(config.releaseHoldMs)
  )
    throw new Error("Invalid wallet sign-in limits.");
  if (config.candidates.length === 0)
    throw new Error("At least one wallet is required.");
  const supported = new Set<LaserEyesProviderId>(laserEyesProviderIds);
  const seen = new Set<LaserEyesProviderId>();
  for (const candidate of config.candidates) {
    if (!supported.has(candidate.id))
      throw new Error(`Unsupported wallet: ${candidate.id}.`);
    if (candidate.label.trim().length === 0)
      throw new Error(`${candidate.id} requires a display label.`);
    if (seen.has(candidate.id))
      throw new Error(`${candidate.id} is configured more than once.`);
    seen.add(candidate.id);
  }
  return Object.freeze({
    ...config,
    candidates: Object.freeze(
      config.candidates.map((c) => Object.freeze({ ...c })),
    ),
  });
}
