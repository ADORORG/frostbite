import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeInfoCard } from "@repo/ui/arcade";

// What the log says about claims: the last pause or resume that took effect, and the two buttons. Any staff member may pause and
// resume; each is a step that is logged. The contract itself is the source of truth for whether claims are open; this shows only
// what staff have done.
export function PauseCard({
  busy,
  onChange,
  steps,
}: {
  readonly busy: boolean;
  readonly onChange: (paused: boolean) => void;
  readonly steps: readonly GameAdminStep[];
}) {
  const last = [...steps]
    .reverse()
    .find(
      (step) =>
        step.operation === "set-claims-paused" && step.state === "complete",
    );
  return (
    <ArcadeInfoCard title="Claims">
      <p data-testid="pause-status">
        {last === undefined
          ? "No pause or resume has been recorded for this game."
          : `Last recorded: claims ${last.summary.paused === true ? "paused" : "resumed"} by ${last.submittedBy ?? "an account that no longer exists"} at ${last.createdAt}.`}
      </p>
      <ArcadeActionButton
        disabled={busy}
        onClick={() => onChange(true)}
        tone="pink"
      >
        Pause claims
      </ArcadeActionButton>{" "}
      <ArcadeActionButton
        disabled={busy}
        onClick={() => onChange(false)}
        tone="mint"
      >
        Resume claims
      </ArcadeActionButton>
    </ArcadeInfoCard>
  );
}
