import { studioHomePath } from "@frostbite/shared/collections";
import type { CreatorApplicationResponse } from "@frostbite/shared/creator-admission";
import { ArcadeButton, PageFrame, StatusLamp } from "@repo/ui/arcade";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import { StudioApplication } from "./studio-application.tsx";

// The applicant's page: where their application stands and what to do about it. Reviewers have their own
// pages (the queue and one application), reached from the admin area.
export function CreatorApplicationSurface({
  application,
  navigation = [],
  unavailable,
}: {
  readonly application: CreatorApplicationResponse["application"] | null;
  readonly navigation?: readonly NavigationItem[];
  readonly unavailable: boolean;
}) {
  return (
    <PageFrame
      eyebrow="Creator admission"
      heading="Apply to create"
      intro="Admission is separate from project publication, deployment, launch, mint, and game permissions."
      navigation={navigation}
    >
      {unavailable ? (
        <StatusLamp
          label="Admission service unavailable. No state is being inferred."
          tone="unavailable"
        />
      ) : (
        <StudioApplication initial={application} />
      )}
      <div className="arcade-actions">
        <ArcadeButton href={studioHomePath} tone="cyan">
          Back to studio
        </ArcadeButton>
      </div>
    </PageFrame>
  );
}
