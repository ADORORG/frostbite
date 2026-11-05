import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import {
  creatorApplicationPath,
  creatorReviewDetailPath,
  creatorReviewPath,
} from "@frostbite/shared/creator-admission";

import { createCreatorApplicationOperations } from "./application/operations.ts";
import { createCreatorReviewOperations } from "./application/review-operations.ts";
import { presentApplication } from "./application/present.ts";
import { getCreatorAdmissionService } from "./runtime.ts";
import { CreatorApplicationSurface } from "./ui/creator-application-surface.tsx";
import { ReviewDetailSurface } from "./ui/detail-surface.tsx";
import { ReviewQueueSurface } from "./ui/queue-surface.tsx";

const reviewAccess = {
  capability: "creator:review",
  kind: "platform",
} as const;

async function studio(
  actorUserId: UuidV7 | null,
  navigation: readonly NavigationItem[],
) {
  if (actorUserId === null) return null;
  try {
    const application =
      await getCreatorAdmissionService().findMine(actorUserId);
    return (
      <CreatorApplicationSurface
        application={
          application === null ? null : presentApplication(application)
        }
        navigation={navigation}
        unavailable={false}
      />
    );
  } catch {
    return (
      <CreatorApplicationSurface
        application={null}
        navigation={navigation}
        unavailable
      />
    );
  }
}

export function createCreatorAdmissionEntrypoint(): FeatureEntrypoint {
  const [mine, saveDraft, submit, review] = createCreatorApplicationOperations(
    getCreatorAdmissionService,
  );
  const [queue, read] = createCreatorReviewOperations(
    getCreatorAdmissionService,
  );
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    id: "creator-admission",
    operations: [
      registerHttpOperation(mine),
      registerHttpOperation(saveDraft),
      registerHttpOperation(submit),
      registerHttpOperation(review),
      registerHttpOperation(queue),
      registerHttpOperation(read),
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: creatorApplicationPath,
        render: ({ actorUserId, navigation }) =>
          studio(actorUserId, navigation),
      },
      {
        access: reviewAccess,
        path: creatorReviewPath,
        render: ({ navigation }) => (
          <ReviewQueueSurface navigation={navigation} />
        ),
      },
      {
        access: reviewAccess,
        path: creatorReviewDetailPath,
        render: ({ navigation, params }) => (
          // The registry matches this page only with its segment, so the parameter is always present.
          <ReviewDetailSurface
            applicationId={params.applicationId ?? ""}
            navigation={navigation}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
