import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it } from "vitest";

import { createUploadsFeature } from "../src/registration.ts";

// `load` imports the whole entrypoint, which pulls in React and the studio UI; under coverage on a busy
// machine that import alone can pass the default five seconds, so the limit is explicit.
const entrypointImportTimeoutMs = 30_000;

describe("uploads feature registration", () => {
  it(
    "declares detachable routes and their provider capability",
    async () => {
      const feature = createUploadsFeature(createProviderRegistry([]));
      expect(feature.manifest).toMatchObject({
        id: "uploads",
        requiredProviderCapabilities: ["object-storage:s3-compatible"],
        routes: [
          {
            method: "POST",
            operationId: "listOlderUploadedAssets",
            path: "/api/v1/uploads/assets/older",
          },
          {
            method: "GET",
            operationId: "listUploadedAssets",
            path: "/api/v1/uploads/assets",
          },
          {
            method: "POST",
            operationId: "completeUploadIntent",
            path: "/api/v1/uploads/intents/complete",
          },
          {
            method: "POST",
            operationId: "createUploadIntent",
            path: "/api/v1/uploads/intents",
          },
        ],
      });
      await expect(
        feature.load({
          registeredFeatureCount: 1,
          registeredFeatureIds: ["uploads"],
        }),
      ).resolves.toMatchObject({ id: "uploads" });
    },
    entrypointImportTimeoutMs,
  );
});
