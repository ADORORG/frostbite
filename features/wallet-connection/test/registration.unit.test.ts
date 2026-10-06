import { describe, expect, it } from "vitest";
import { createWalletConnectionFeature } from "../src/registration.ts";

describe("wallet connection registration", () => {
  // Imports the real client/server entrypoint under instrumentation, not just its manifest.
  it("declares its route, navigation, and provider capability", async () => {
    const feature = createWalletConnectionFeature({
      candidates: [{ id: "xverse", label: "Xverse" }],
      network: "signet",
    });
    expect(feature.manifest).toMatchObject({
      navigation: [{ href: "/connect", label: "Connect" }],
      pages: [{ path: "/connect" }],
      requiredProviderCapabilities: ["wallet:connect", "wallet:message-sign"],
    });
    await expect(
      feature.load({
        registeredFeatureCount: 1,
        registeredFeatureIds: ["wallet-connection"],
      }),
    ).resolves.toMatchObject({
      id: "wallet-connection",
    });
  }, 30_000);
});
