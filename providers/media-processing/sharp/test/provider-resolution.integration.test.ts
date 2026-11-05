import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import { describe, expect, it } from "vitest";

import { sharpMediaProcessingProvider } from "../src/registration.ts";
import { makeImage } from "./support/images.ts";

describe("sharp provider resolved through the registry", () => {
  it("processes a real image through the typed capability in an isolated worker", async () => {
    const registry = createProviderRegistry([sharpMediaProcessingProvider]);
    const processor = await registry.resolve(
      "media-processing:image-derivatives",
    );
    const bytes = await makeImage({
      format: "webp",
      height: 700,
      width: 1_400,
    });
    const result = await processor.process({
      bytes,
      derivatives: [
        { kind: "thumbnail", maxSide: 256 },
        { kind: "preview", maxSide: 1_024 },
      ],
      expected: { height: 700, width: 1_400 },
      limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
      quality: 80,
    });
    expect(result).toMatchObject({
      derivatives: [
        { height: 128, kind: "thumbnail", width: 256 },
        { height: 512, kind: "preview", width: 1_024 },
      ],
      ok: true,
    });
  });

  it("resolves the same process-local service on every call", async () => {
    const registry = createProviderRegistry([sharpMediaProcessingProvider]);
    expect(await registry.resolve("media-processing:image-derivatives")).toBe(
      await registry.resolve("media-processing:image-derivatives"),
    );
  });
});
