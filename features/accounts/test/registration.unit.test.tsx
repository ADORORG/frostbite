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
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "public-page",
      ],
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

  it("offers visitors a public way to the sign-in page and shows staff only the admin entry", () => {
    const entries = accountsFeature.manifest.navigation ?? [];
    expect(entries.find(({ href }) => href === "/sign-in")).toMatchObject({
      access: { kind: "public" },
      label: "Sign in",
    });
    expect(entries.find(({ href }) => href === "/account")?.access).toEqual({
      kind: "authenticated",
    });
    expect(entries.find(({ href }) => href === "/admin")?.access).toEqual({
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
