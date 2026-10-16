import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeInfoCard } from "@repo/ui/arcade";

import { operationLabel, stateCopy } from "../domain/copy.ts";

const who = (name: string | null): string =>
  name ?? "an account that no longer exists";

// The log of what staff did to this game's contract, newest first: who built each step, who sent it, and where it stands. It is the
// record that pausing and defining are reviewed from.
export function StepLog({
  onOpen,
  steps,
}: {
  readonly onOpen: (stepId: string) => void;
  readonly steps: readonly GameAdminStep[];
}) {
  const newestFirst = [...steps].reverse();
  return (
    <ArcadeInfoCard title="Log">
      {newestFirst.length === 0 ? (
        <p>Nothing has been done to this game&apos;s contract yet.</p>
      ) : (
        <ul aria-label="Steps taken on this game">
          {newestFirst.map((step) => (
            <li data-step-state={step.state} key={step.id}>
              <strong>{operationLabel(step)}</strong> —{" "}
              <span>{stateCopy[step.state].label}</span>
              <br />
              <small>
                {`Built by ${who(step.createdBy)} at ${step.createdAt}`}
                {step.submittedBy === null
                  ? ""
                  : `; sent by ${who(step.submittedBy)}`}
              </small>{" "}
              <ArcadeActionButton onClick={() => onOpen(step.id)} tone="cyan">
                Details
              </ArcadeActionButton>
            </li>
          ))}
        </ul>
      )}
    </ArcadeInfoCard>
  );
}
