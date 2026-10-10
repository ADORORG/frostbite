import { collectionReviewCapability } from "@ador/shared/collections";
import { authorizationPolicy } from "@repo/config/authorization";
import { describe, expect, it } from "vitest";

import { createCollectionReviewEntrypoint } from "../src/entrypoint.ts";
import { createCollectionReviewFeature } from "../src/registration.ts";

describe("collection review registration", () => {
  it("declares detachable API routes only, depending on the features whose data it reviews", () => {
    const { manifest } = createCollectionReviewFeature(authorizationPolicy);
    expect(manifest).toMatchObject({
      capabilities: ["api-routes"],
      dependencies: ["accounts", "collection-studio"],
      id: "collection-review",
      navigation: [],
      pages: [],
      requiredProviderCapabilities: [],
    });
    expect(
      manifest.routes.map(
        ({ method, operationId }) => `${method} ${operationId}`,
      ),
    ).toEqual([
      "POST decideCollectionReview",
      "POST listCollectionReviewQueue",
      "POST readCollectionReviewSubmission",
    ]);
  });

  it("loads an entrypoint whose operations match the manifest and all require the review capability", async () => {
    const feature = createCollectionReviewFeature(authorizationPolicy);
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["collection-review"],
    });
    expect(entrypoint.operations?.map(({ route }) => route)).toEqual(
      feature.manifest.routes,
    );
    expect(entrypoint.pages ?? []).toEqual([]);
    for (const operation of entrypoint.operations ?? [])
      expect(operation.access).toEqual({
        capability: collectionReviewCapability,
        kind: "platform",
      });
    expect(entrypoint.id).toBe(feature.manifest.id);
  });

  it("grants the capability to reviewers in the platform policy", () => {
    expect(authorizationPolicy.platform.reviewer).toContain(
      collectionReviewCapability,
    );
    expect(createCollectionReviewEntrypoint(authorizationPolicy).id).toBe(
      "collection-review",
    );
  });
});
