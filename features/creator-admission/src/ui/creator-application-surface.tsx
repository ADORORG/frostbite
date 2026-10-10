import type { CreatorApplicationResponse } from "@ador/shared/creator-admission";
import { AppShell, ArcadeButton, StatusLamp } from "@repo/ui/arcade";
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
    <AppShell
      brand="Adorbitals"
      footerLabel="Creator admission beta"
      homeHref="/"
      navigation={navigation}
      notices={[
        "◆ PRIVATE EVIDENCE",
        "▲ EXPLICIT STATES",
        "★ SERVER AUTHORITY",
      ]}
    >
      <section className="arcade-section arcade-section--raised">
        <p className="arcade-eyebrow">Creator admission</p>
        <h1>
          {mode === "studio" ? "Apply to create" : "Review creator admission"}
        </h1>
        <p>
          Admission is separate from project publication, deployment, launch,
          mint, and game permissions.
        </p>
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
        <div className="arcade-actions">
          <ArcadeButton href="/studio" tone="cyan">
            Back to studio
          </ArcadeButton>
        </div>
      </section>
    </AppShell>
  );
}
