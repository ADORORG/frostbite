import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it } from "vitest";

import { sharpMediaProcessingProvider } from "../src/registration.ts";

describe("sharp media-processing provider registration", () => {
  it("loads an entrypoint matching its explicit manifest", async () => {
    await expect(sharpMediaProcessingProvider.load()).resolves.toMatchObject({
      capabilities: ["media-processing:image-derivatives"],
      createServices: expect.any(Function),
      id: "sharp-media-processing",
      version: "1.0.0",
    });
    expect(sharpMediaProcessingProvider.manifest.requiredDecisionGates).toEqual(
      [],
    );
  });

  it("resolves the typed image-derivative capability through the registry", async () => {
    const registry = createProviderRegistry([sharpMediaProcessingProvider]);
    expect(registry.hasCapability("media-processing:image-derivatives")).toBe(
      true,
    );
    const processor = await registry.resolve(
      "media-processing:image-derivatives",
    );
    expect(processor.process).toEqual(expect.any(Function));
  });
});
