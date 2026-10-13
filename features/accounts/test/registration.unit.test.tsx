import { describe, expect, it } from "vitest";

import { createAccountsFeature } from "../src/registration.ts";
import { passkeyRoutes, walletAuthRoutes } from "@ador/auth";
import { walletConfig } from "./support/wallet-config.ts";

const accountsFeature = createAccountsFeature(walletConfig);
const allRoutes = [
  ...Object.values(passkeyRoutes),
  ...Object.values(walletAuthRoutes),
];
const byOperation = (a: { operationId: string }, b: { operationId: string }) =>
  a.operationId.localeCompare(b.operationId);

describe("accounts feature registration", () => {
  it("declares the complete detachable access contract", () => {
    expect(accountsFeature.manifest).toMatchObject({
      capabilities: ["api-routes", "authenticated-page", "navigation"],
      id: "accounts",
      pages: [
        { access: { kind: "public" }, path: "/sign-in" },
        { access: { kind: "authenticated" }, path: "/account" },
        {
          access: { capability: "platform:operate", kind: "platform" },
          path: "/admin",
        },
      ],
      routes: allRoutes,
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
