import { defineFeature } from "@ador/plugin-kit";
import { emailCodeRoutes, passkeyRoutes, walletAuthRoutes } from "@ador/auth";
import { manageRolesCapability } from "@ador/shared/accounts";

import { walletBalanceRoute } from "./balance/contract.ts";
import type { BalanceSource } from "./balance/source.ts";

export type { AddressHoldings, BalanceSource } from "./balance/source.ts";
import {
  createPasskeyServiceResolver,
  createPasskeySignInResolver,
  createSetupLinkResolver,
  createWalletServicesResolver,
  offeredSignInKinds,
  type AccountMethods,
  type SetupRules,
} from "./runtime.ts";
import {
  createEmailResolvers,
  type EmailSignInRules,
} from "./email-runtime.ts";
import { roleRoutes } from "./roles/contract.ts";
import { createRoleServicesResolver } from "./roles/runtime.ts";
import { setupLinkRoutes } from "./setup/contract.ts";
import {
  validateWalletAuthConfig,
  type WalletAuthConfig,
} from "./wallet-config.ts";

export type { WalletAuthConfig, WalletCandidate } from "./wallet-config.ts";
export { createAuthMethods, createHeldMethodKinds } from "./methods.ts";
export type { EmailSignInRules } from "./email-runtime.ts";

// `balanceSource` is where the widget's balance comes from (confirmed and pending apart); `null` means the platform has no chain to ask
// and the widget says no balance is available.
export function createAccountsFeature(
  input: WalletAuthConfig,
  balanceSource: BalanceSource | null,
  methods: AccountMethods,
  setup: SetupRules,
  // How email sign-in works here, or null when the deployment has no mail (the routes then answer that email is not available).
  email: EmailSignInRules | null,
) {
  const wallet = validateWalletAuthConfig(input);
  // One passkey service for the whole feature, made when a request first needs it.
  const passkeys = createPasskeyServiceResolver(methods);
  // One channel and one sender for signing in by email and for adding an address to an account.
  const emails = createEmailResolvers(email, methods);
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
        {
          access: { capability: manageRolesCapability, kind: "platform" },
          area: "admin",
          href: "/admin/roles",
          label: "Roles",
          order: 90,
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
        {
          access: { capability: manageRolesCapability, kind: "platform" },
          path: "/admin/roles",
        },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [
        ...Object.values(passkeyRoutes),
        ...Object.values(walletAuthRoutes),
        ...Object.values(setupLinkRoutes),
        ...Object.values(emailCodeRoutes),
        ...Object.values(roleRoutes),
        walletBalanceRoute,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-accounts/entrypoint").then(
        ({ createAccountsEntrypoint }) =>
          createAccountsEntrypoint({
            balanceSource,
            emailLinks: emails.links,
            emailSignIn: emails.codes,
            passkeys,
            passkeySignIn: createPasskeySignInResolver(),
            roles: createRoleServicesResolver(methods, setup),
            setupLinks: createSetupLinkResolver(methods, setup),
            signIn: {
              network: wallet.network,
              offered: () => offeredSignInKinds(methods),
            },
            wallet: createWalletServicesResolver(wallet, methods, passkeys),
          }),
      ),
  });
}
