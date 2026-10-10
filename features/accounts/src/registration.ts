import { defineFeature } from "@ador/plugin-kit";
import { passkeyRoutes } from "@ador/auth";

export const accountsFeature = defineFeature({
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
        access: { kind: "authenticated" },
        area: "studio",
        href: "/studio",
        label: "Overview",
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
      { access: { kind: "authenticated" }, path: "/studio" },
      {
        access: { capability: "platform:operate", kind: "platform" },
        path: "/admin",
      },
    ],
    requiredDecisionGates: [],
    requiredProviderCapabilities: [],
    routes: Object.values(passkeyRoutes),
    version: "1.0.0",
  },
  load: async () =>
    import("@ador/feature-accounts/entrypoint").then(
      ({ createAccountsEntrypoint }) => createAccountsEntrypoint(),
    ),
});
