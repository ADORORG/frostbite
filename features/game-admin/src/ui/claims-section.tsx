import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, SectionBlock } from "@repo/ui/arcade";

import { shortTime } from "../domain/facts.ts";

// What the log says about claims: the last pause or resume that took effect, and the two buttons. Any staff member may pause and
// resume; each is a step that is logged. The contract itself is the source of truth for whether claims are open; this shows only
// what staff have done.
export function ClaimsSection({
  busy,
  onChange,
  preparing,
  steps,
}: {
  readonly busy: boolean;
  readonly onChange: (paused: boolean) => void;
  // Which of the two is being prepared now, if either.
  readonly preparing: "pause" | "resume" | null;
  readonly steps: readonly GameAdminStep[];
}) {
  const last = [...steps]
    .reverse()
    .find(
      (step) =>
        step.operation === "set-claims-paused" && step.state === "complete",
    );
  return (
    <SectionBlock
      actions={
        <>
          <ArcadeActionButton
            ariaLabel="Pause claims"
            busy={preparing === "pause"}
            disabled={busy}
            onClick={() => onChange(true)}
            size="small"
            tone="pink"
          >
            Pause claims
          </ArcadeActionButton>
          <ArcadeActionButton
            ariaLabel="Resume claims"
            busy={preparing === "resume"}
            disabled={busy}
            onClick={() => onChange(false)}
            size="small"
            tone="mint"
          >
            Resume claims
          </ArcadeActionButton>
        </>
      }
      title="Claims"
    >
      <p data-testid="pause-status">
        {last === undefined
          ? "No pause or resume has been recorded for this game."
          : `Last recorded: claims ${last.summary.paused === true ? "paused" : "resumed"} by ${last.submittedBy ?? "an account that no longer exists"} at ${shortTime(last.createdAt)}.`}
      </p>
    </SectionBlock>
  );
}
