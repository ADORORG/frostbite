import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { createCreatorApplicationOperations } from "./application/operations.ts";
import { presentApplication } from "./application/present.ts";
import { getCreatorAdmissionService } from "./runtime.ts";
import { CreatorApplicationSurface } from "./ui/creator-application-surface.tsx";

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
        mode="studio"
        navigation={navigation}
        unavailable={false}
      />
    );
  } catch {
    return (
      <CreatorApplicationSurface
        application={null}
        mode="studio"
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
    ],
    pages: [
      {
        access: { kind: "authenticated" },
        path: "/studio/creator-application",
        render: ({ actorUserId, navigation }) =>
          studio(actorUserId, navigation),
      },
      {
        access: { capability: "creator:review", kind: "platform" },
        path: "/admin/creator-applications",
        render: ({ navigation }) => (
          <CreatorApplicationSurface
            application={null}
            mode="review"
            navigation={navigation}
            unavailable={false}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
