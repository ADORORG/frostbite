import { studioHomePath } from "@ador/shared/collections";
import type { CreatorApplicationResponse } from "@ador/shared/creator-admission";
import { ArcadeButton, PageFrame, StatusLamp } from "@repo/ui/arcade";
import type { NavigationItem } from "@ador/plugin-kit/navigation";

import { ReviewerForm } from "./reviewer-form.tsx";
import { StudioApplication } from "./studio-application.tsx";

export function CreatorApplicationSurface({
  application,
  mode,
  navigation = [],
  unavailable,
}: {
  readonly application: CreatorApplicationResponse["application"] | null;
  readonly mode: "studio" | "review";
  readonly navigation?: readonly NavigationItem[];
  readonly unavailable: boolean;
}) {
  return (
    <PageFrame
      eyebrow="Creator admission"
      footerLabel="Creator admission beta"
      heading={
        mode === "studio" ? "Apply to create" : "Review creator admission"
      }
      intro="Admission is separate from project publication, deployment, launch, mint, and game permissions."
      navigation={navigation}
      notices={[
        "◆ PRIVATE EVIDENCE",
        "▲ EXPLICIT STATES",
        "★ SERVER AUTHORITY",
      ]}
    >
      {unavailable ? (
        <StatusLamp
          label="Admission service unavailable. No state is being inferred."
          tone="unavailable"
        />
      ) : mode === "studio" ? (
        <StudioApplication initial={application} />
      ) : (
        <ReviewerForm />
      )}
      {mode === "studio" ? (
        <div className="arcade-actions">
          <ArcadeButton href={studioHomePath} tone="cyan">
            Back to studio
          </ArcadeButton>
        </div>
      ) : null}
    </PageFrame>
  );
}
