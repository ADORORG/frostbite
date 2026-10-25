import { defineFeature } from "@ador/plugin-kit";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";

import { walletBalanceRoute } from "./balance/contract.ts";
import type { BalanceSource } from "./balance/source.ts";

export type { AddressHoldings, BalanceSource } from "./balance/source.ts";
import {
  createPasskeyServiceResolver,
  createSetupLinkResolver,
  createWalletServicesResolver,
  offeredSignInKinds,
  type AccountMethods,
  type SetupRules,
} from "./runtime.ts";
import { setupLinkRoutes } from "./setup/contract.ts";
import {
  validateWalletAuthConfig,
  type WalletAuthConfig,
} from "./wallet-config.ts";

export type { WalletAuthConfig, WalletCandidate } from "./wallet-config.ts";
export { authMethods, createHeldMethodKinds } from "./methods.ts";

// `balanceSource` is where the widget's balance comes from (confirmed and pending apart); `null` means the platform has no chain to ask
// and the widget says no balance is available.
export function createAccountsFeature(
  input: WalletAuthConfig,
  balanceSource: BalanceSource | null,
  methods: AccountMethods,
  setup: SetupRules,
) {
  const wallet = validateWalletAuthConfig(input);
  // One passkey service for the whole feature, made when a request first needs it.
  const passkeys = createPasskeyServiceResolver(methods);
  return defineFeature({
    manifest: {
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "public-page",
      ],
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
        { access: { kind: "public" }, path: "/sign-in" },
        { access: { kind: "public" }, path: "/setup" },
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
        ...Object.values(setupLinkRoutes),
        walletBalanceRoute,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-accounts/entrypoint").then(
        ({ createAccountsEntrypoint }) =>
          createAccountsEntrypoint(
            createWalletServicesResolver(wallet, methods, passkeys),
            balanceSource,
            createSetupLinkResolver(methods, setup),
            passkeys,
            {
              network: wallet.network,
              offered: () => offeredSignInKinds(methods),
            },
          ),
      ),
  });
}
