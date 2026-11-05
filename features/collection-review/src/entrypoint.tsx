import { createUploadsContextResolver } from "@frostbite/feature-uploads/context";
import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import type { ProviderRegistry } from "@frostbite/plugin-kit/providers";
import type { AuthorizationPolicy } from "@frostbite/shared/accounts";
import {
  collectionReviewActivityPath,
  collectionReviewCapability,
  collectionReviewDetailPath,
  collectionReviewQueuePath,
} from "@frostbite/shared/collections";

import {
  createActivityOperation,
  createDecideOperation,
  createQueueOperation,
  createReadOperation,
} from "./application/operations.ts";
import {
  createPreviewResolver,
  createReviewServiceResolver,
} from "./runtime.ts";
import { ActivitySurface } from "./ui/activity-surface.tsx";
import { DetailSurface } from "./ui/detail-surface.tsx";
import { QueueSurface } from "./ui/queue-surface.tsx";

const access = {
  capability: collectionReviewCapability,
  kind: "platform",
} as const;

export function createCollectionReviewEntrypoint(
  authorizationPolicy: AuthorizationPolicy,
  providers: ProviderRegistry,
): FeatureEntrypoint {
  const context = createUploadsContextResolver(providers);
  const getService = createReviewServiceResolver(authorizationPolicy, context);
  const getPreviews = createPreviewResolver(context);
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    id: "collection-review",
    operations: [
      registerHttpOperation(createActivityOperation(getService)),
      registerHttpOperation(createDecideOperation(getService)),
      registerHttpOperation(createQueueOperation(getService)),
      registerHttpOperation(createReadOperation(getService, getPreviews)),
    ],
    pages: [
      {
        access,
        path: collectionReviewQueuePath,
        render: ({ navigation }) => <QueueSurface navigation={navigation} />,
      },
      {
        access,
        path: collectionReviewActivityPath,
        render: ({ navigation }) => <ActivitySurface navigation={navigation} />,
      },
      {
        access,
        path: collectionReviewDetailPath,
        render: ({ navigation, params }) => (
          <DetailSurface
            navigation={navigation}
            submissionId={params.submissionId ?? ""}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
