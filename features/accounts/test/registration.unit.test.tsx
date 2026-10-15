import { describe, expect, it } from "vitest";

import { createAccountsFeature } from "../src/registration.ts";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";
import { walletBalanceRoute } from "../src/balance/contract.ts";
import { walletConfig } from "./support/wallet-config.ts";

const accountsFeature = createAccountsFeature(walletConfig, null);
const allRoutes = [
  ...Object.values(passkeyRoutes),
  ...Object.values(walletAuthRoutes),
  walletBalanceRoute,
];
const byOperation = (a: { operationId: string }, b: { operationId: string }) =>
  a.operationId.localeCompare(b.operationId);

describe("accounts feature registration", () => {
  it("declares the complete detachable access contract", () => {
    expect(accountsFeature.manifest).toMatchObject({
      capabilities: ["api-routes", "authenticated-page", "navigation"],
      id: "accounts",
      pages: [
        { access: { kind: "authenticated" }, path: "/account" },
        {
          access: { capability: "platform:operate", kind: "platform" },
          path: "/admin",
        },
      ],
      routes: allRoutes,
    });
  });

  it("has no page or navigation entry of its own for signing in: that is the wallet widget's job", () => {
    const { navigation = [], pages = [] } = accountsFeature.manifest;
    expect(pages.some(({ access }) => access.kind === "public")).toBe(false);
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
