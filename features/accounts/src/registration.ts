import { defineFeature } from "@ador/plugin-kit";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";

import { createWalletServicesResolver } from "./runtime.ts";
import type { WalletAuthConfig } from "./wallet-config.ts";

export type { WalletAuthConfig } from "./wallet-config.ts";

export function createAccountsFeature(wallet: WalletAuthConfig) {
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
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-accounts/entrypoint").then(
        ({ createAccountsEntrypoint }) =>
          createAccountsEntrypoint(createWalletServicesResolver(wallet)),
      ),
  });
}
