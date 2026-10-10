import { describe, expect, it } from "vitest";

import { accountsFeature } from "../src/registration.ts";
import { passkeyRoutes } from "@ador/auth";

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
      routes: Object.values(passkeyRoutes),
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
    expect(entrypoint.operations?.map(({ route }) => route)).toEqual(
      Object.values(passkeyRoutes),
    );
  });
});
