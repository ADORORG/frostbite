import { submissionRequirementCopy } from "@ador/shared/collections";
import { ArcadeActionButton, StatusLamp } from "@repo/ui/arcade";

import type { SubmitAvailability } from "../../client/submission-progress.ts";

// The one control for submitting, and the reason when it is not available. A submission freezes the
// last saved version, so unsaved edits must be saved first.
export function SubmitPanel({
  availability,
  busy,
  onSubmit,
  unsaved,
}: {
  readonly availability: SubmitAvailability;
  readonly busy: boolean;
  readonly onSubmit: () => void;
  readonly unsaved: boolean;
}) {
  if (availability.kind === "live" || availability.kind === "closed")
    return null;
  if (availability.kind === "missing")
    return (
      <StatusLamp
        label={`Not ready to submit yet. It needs ${availability.missing.map((need) => submissionRequirementCopy[need]).join(", ")}.`}
        tone="attention"
      />
    );
  return (
    <div className="arcade-form">
      <p>
        Submitting freezes this version for a reviewer. You can keep editing
        afterwards, but only what you submit now is reviewed.
      </p>
      {unsaved ? (
        <StatusLamp
          label="Save your changes on the earlier steps before submitting."
          tone="attention"
        />
      ) : null}
      <div className="arcade-actions">
        <ArcadeActionButton
          disabled={busy || unsaved}
          onClick={onSubmit}
          tone="mint"
        >
          {availability.again ? "Submit again" : "Submit for review"}
        </ArcadeActionButton>
      </div>
    </div>
  );
}
