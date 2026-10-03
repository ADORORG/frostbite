import type { LaserEyesProviderId } from "../conformance/contracts.ts";
import type { WalletNetwork } from "../contracts.ts";

// Pinned LaserEyes core 0.0.85 Phantom connect() rejects its test-network predicate:
// testnet, testnet4, and signet. This describes adapter behavior, not qualification.
export function walletNetworkUnavailableReason(
  provider: LaserEyesProviderId,
  network: WalletNetwork,
): string | null {
  if (provider === "phantom" && network === "signet") {
    return `Unavailable on ${network} with the current wallet adapter`;
  }
  return null;
}
