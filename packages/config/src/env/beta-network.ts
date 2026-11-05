import { betaNetworkSchema, type BetaNetwork } from "@frostbite/shared/chain";

// The test network this deployment runs the beta on. Blank means signet, the documented beta network (ADR-008); a value the platform
// has no chain record for stops boot, since a wallet, a game or a node on another network would otherwise be trusted silently.
export function parseBetaNetworkEnvironment(
  source: NodeJS.ProcessEnv,
): BetaNetwork {
  const value = source.BETA_NETWORK?.trim() ?? "";
  if (value === "") return "signet";
  const parsed = betaNetworkSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `BETA_NETWORK must be one of ${betaNetworkSchema.options.join(", ")}.`,
    );
  }
  return parsed.data;
}
