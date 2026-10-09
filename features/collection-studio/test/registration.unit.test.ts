import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { chainOptionSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { createCollectionStudioFeature } from "../src/registration.ts";
import { signet } from "./support/stubs.ts";

const targetChains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];

describe("collection studio registration", () => {
  it("declares detachable API routes, their feature dependencies, and the storage capability", () => {
    const feature = createCollectionStudioFeature(
      createProviderRegistry([]),
      targetChains,
    );
    expect(feature.manifest).toMatchObject({
      capabilities: ["api-routes"],
      dependencies: ["accounts", "creator-admission", "uploads"],
      id: "collection-studio",
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
    });
    expect(
      feature.manifest.routes.map(
        ({ method, operationId }) => `${method} ${operationId}`,
      ),
    ).toEqual([
      "POST addCollectionItem",
      "POST createCollectionDraft",
      "GET listCollectionDrafts",
      "POST readCollectionDraft",
      "DELETE removeCollectionItem",
      "PUT saveCollectionDraft",
      "PUT updateCollectionItem",
    ]);
  });

  it("loads an entrypoint whose operations match the manifest exactly", async () => {
    const feature = createCollectionStudioFeature(
      createProviderRegistry([]),
      targetChains,
    );
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["collection-studio"],
    });
    const declared = feature.manifest.routes.map(
      ({ method, operationId, path }) => `${method} ${path} ${operationId}`,
    );
    const loaded = (entrypoint.operations ?? []).map(
      ({ route }) => `${route.method} ${route.path} ${route.operationId}`,
    );
    expect(loaded.sort()).toEqual([...declared].sort());
    expect(entrypoint).toMatchObject({ id: "collection-studio" });
  });
});
