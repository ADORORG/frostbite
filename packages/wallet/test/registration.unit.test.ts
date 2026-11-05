import { describe, expect, it } from "vitest";

import { createProviderRegistry } from "@frostbite/plugin-kit/providers";

import { laserEyesProvider } from "../src/registration.js";

describe("LaserEyes provider registration", () => {
  it("attaches and detaches through one explicit registry entry", async () => {
    const attached = createProviderRegistry([laserEyesProvider]);
    expect(attached.hasCapability("wallet:message-sign")).toBe(true);
    await expect(attached.load("lasereyes")).resolves.toMatchObject({
      id: "lasereyes",
      version: "1.0.0",
    });

    const detached = createProviderRegistry([]);
    expect(detached.hasCapability("wallet:message-sign")).toBe(false);
    await expect(detached.load("lasereyes")).rejects.toThrow("not registered");
  });
});
