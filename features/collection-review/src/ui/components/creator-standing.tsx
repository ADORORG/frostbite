import type { ReviewSubmission } from "@frostbite/shared/collections";
import { creatorStandingCopy } from "@frostbite/shared/creator-admission";
import { StatusLamp } from "@repo/ui/arcade";

// The creator's standing now. An approval is refused for anyone who is not an approved creator, so a
// reviewer should see that before choosing, not learn it from a refusal.
export function CreatorStanding({
  state,
}: {
  readonly state: ReviewSubmission["ownerState"];
}) {
  if (state === "approved")
    return (
      <StatusLamp
        label={`Creator standing: ${creatorStandingCopy.approved.headline}`}
        tone="ready"
      />
    );
  return (
    <StatusLamp
      label={
        state === null
          ? "Creator standing: never applied. An approval will be refused."
          : `Creator standing: ${creatorStandingCopy[state].headline}. An approval will be refused.`
      }
      tone="unavailable"
    />
  );
}
