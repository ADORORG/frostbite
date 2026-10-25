import { describe, expect, it } from "vitest";

import { createAccountsFeature } from "../src/registration.ts";
import { authMethods } from "../src/methods.ts";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";
import { setupLinkRoutes } from "../src/setup/contract.ts";
import { walletBalanceRoute } from "../src/balance/contract.ts";
import { walletConfig } from "./support/wallet-config.ts";

const accountsFeature = createAccountsFeature(walletConfig, null, authMethods, {
  lifetimeMs: 3_600_000,
  policyVersion: "test-v2",
  requiredMethods: { admin: ["wallet"] },
});
const allRoutes = [
  ...Object.values(passkeyRoutes),
  ...Object.values(walletAuthRoutes),
  ...Object.values(setupLinkRoutes),
  walletBalanceRoute,
];
const byOperation = (a: { operationId: string }, b: { operationId: string }) =>
  a.operationId.localeCompare(b.operationId);

describe("accounts feature registration", () => {
  it("declares the complete detachable access contract", () => {
    expect(accountsFeature.manifest).toMatchObject({
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "public-page",
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
      routes: allRoutes,
    });
  });

  it("has two public pages, sign-in and first-time setup, and no navigation entry for either: signing in is reached from a protected page or the wallet button, and a setup link is handed over by the operator", () => {
    const { navigation = [], pages = [] } = accountsFeature.manifest;
    expect(pages.filter(({ access }) => access.kind === "public")).toEqual([
      { access: { kind: "public" }, path: "/sign-in" },
      { access: { kind: "public" }, path: "/setup" },
    ]);
    expect(navigation.some(({ access }) => access.kind === "public")).toBe(
      false,
    );
    expect(navigation.find(({ href }) => href === "/account")?.access).toEqual({
      kind: "authenticated",
    });
    expect(navigation.find(({ href }) => href === "/admin")?.access).toEqual({
      capability: "platform:operate",
      kind: "platform",
    });
  });

  it("loads the matching detachable entrypoint", async () => {
    const entrypoint = await accountsFeature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["accounts"],
    });

    expect(entrypoint).toMatchObject({
      capabilities: accountsFeature.manifest.capabilities,
      id: accountsFeature.manifest.id,
      version: accountsFeature.manifest.version,
    });
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual([
      "/sign-in",
      "/setup",
      "/account",
      "/admin",
    ]);
    // Every route the manifest declares has an operation, and no operation is declared without a route.
    expect(
      [...(entrypoint.operations?.map(({ route }) => route) ?? [])].sort(
        byOperation,
      ),
    ).toEqual([...allRoutes].sort(byOperation));
  });
});
