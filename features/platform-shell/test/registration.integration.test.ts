import { describe, expect, it } from "vitest";

import { createFeatureRegistry } from "@frostbite/plugin-kit";

import { platformShellFeature } from "../src/registration.js";

describe("platform shell registration", () => {
  it("loads through the shared registry contract", async () => {
    const registry = createFeatureRegistry([platformShellFeature]);
    await expect(registry.load("platform-shell")).resolves.toMatchObject({
      id: "platform-shell",
      capabilities: ["api-routes", "navigation", "public-page"],
    });
  });
});
