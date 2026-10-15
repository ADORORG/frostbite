import { defineFeature } from "@ador/plugin-kit";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";

import { walletBalanceRoute } from "./balance/contract.ts";
import type { BalanceSource } from "./balance/source.ts";
import { createWalletServicesResolver } from "./runtime.ts";
import {
  validateWalletAuthConfig,
  type WalletAuthConfig,
} from "./wallet-config.ts";

export type { WalletAuthConfig, WalletCandidate } from "./wallet-config.ts";

// `balanceSource` is where the widget's balance comes from. The platform has not chosen an indexer, so the beta passes
// `null` and the widget says no balance is available.
export function createAccountsFeature(
  input: WalletAuthConfig,
  balanceSource: BalanceSource | null,
) {
  const wallet = validateWalletAuthConfig(input);
  return defineFeature({
    manifest: {
      capabilities: ["api-routes", "authenticated-page", "navigation"],
      dependencies: [],
      navigation: [
        {
          access: { kind: "authenticated" },
          area: "account",
          href: "/account",
          label: "Account",
          order: 0,
        },
        {
          access: { capability: "platform:operate", kind: "platform" },
          area: "admin",
          href: "/admin",
          label: "Overview",
          order: 0,
        },
      ],
      id: "accounts",
      pages: [
        { access: { kind: "authenticated" }, path: "/account" },
        {
          access: { capability: "platform:operate", kind: "platform" },
          path: "/admin",
        },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [
        ...Object.values(passkeyRoutes),
        ...Object.values(walletAuthRoutes),
        walletBalanceRoute,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-accounts/entrypoint").then(
        ({ createAccountsEntrypoint }) =>
          createAccountsEntrypoint(
            createWalletServicesResolver(wallet),
            balanceSource,
          ),
      ),
  });
}
