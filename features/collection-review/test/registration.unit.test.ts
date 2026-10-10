import { createProviderRegistry } from "@ador/plugin-kit/providers";
import {
  collectionReviewCapability,
  collectionReviewDetailPath,
  collectionReviewNavigationLabel,
  collectionReviewQueuePath,
} from "@ador/shared/collections";
import { authorizationPolicy } from "@repo/config/authorization";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { createCollectionReviewFeature } from "../src/registration.ts";

const providers = createProviderRegistry([]);

describe("collection review registration", () => {
  it("declares detachable routes and admin pages for reviewers, depending on the features whose data it reviews", () => {
    const { manifest } = createCollectionReviewFeature(
      authorizationPolicy,
      providers,
    );
    const access = { capability: collectionReviewCapability, kind: "platform" };
    expect(manifest).toMatchObject({
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts", "collection-studio", "uploads"],
      id: "collection-review",
      navigation: [
        {
          access,
          href: collectionReviewQueuePath,
          label: collectionReviewNavigationLabel,
        },
      ],
      pages: [
        { access, path: collectionReviewQueuePath },
        { access, path: collectionReviewDetailPath },
      ],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
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

  it("loads an entrypoint whose operations and pages match the manifest, all requiring the review capability", async () => {
    const feature = createCollectionReviewFeature(
      authorizationPolicy,
      providers,
    );
    const entrypoint = await feature.load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["collection-review"],
    });
    expect(entrypoint.operations?.map(({ route }) => route)).toEqual(
      feature.manifest.routes,
    );
    expect(entrypoint.pages?.map(({ path }) => path)).toEqual(
      feature.manifest.pages.map(({ path }) => path),
    );
    for (const { access } of [
      ...(entrypoint.operations ?? []),
      ...(entrypoint.pages ?? []),
    ])
      expect(access).toEqual({
        capability: collectionReviewCapability,
        kind: "platform",
      });
    expect(entrypoint.id).toBe(feature.manifest.id);
  });

  it("renders the queue page, and the detail page for the submission named in the path", async () => {
    const entrypoint = await createCollectionReviewFeature(
      authorizationPolicy,
      providers,
    ).load({
      registeredFeatureCount: 1,
      registeredFeatureIds: ["collection-review"],
    });
    const [queue, detail] = entrypoint.pages ?? [];
    const navigation = [] as const;
    const submissionId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
    const queuePage = queue?.render({
      actorUserId: null,
      navigation,
      params: {},
    });
    const detailPage = detail?.render({
      actorUserId: null,
      navigation,
      params: { submissionId },
    });
    const empty = detail?.render({ actorUserId: null, navigation, params: {} });
    for (const page of [queuePage, detailPage, empty])
      expect(isValidElement(page)).toBe(true);
    expect(isValidElement(detailPage) && detailPage.props).toMatchObject({
      submissionId,
    });
    expect(isValidElement(empty) && empty.props).toMatchObject({
      submissionId: "",
    });
  });

  it("grants the capability to reviewers, and not to staff, in the platform policy", () => {
    expect(authorizationPolicy.platform.reviewer).toContain(
      collectionReviewCapability,
    );
    expect(authorizationPolicy.platform.staff).not.toContain(
      collectionReviewCapability,
    );
  });
});
