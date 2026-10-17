import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeInfoCard } from "@repo/ui/arcade";

import { operationLabel, showsDelayed, stepCopy } from "../domain/copy.ts";

const who = (name: string | null): string =>
  name ?? "an account that no longer exists";

// The log of what staff did (to a game's contract, or publishing templates), newest first: who built each step, who sent it, and where it stands. It is the
// record that pausing and defining are reviewed from.
export function StepLog({
  empty = "Nothing has been done to this game's contract yet.",
  onOpen,
  steps,
  title = "Log",
}: {
  // What the log says while it is empty.
  readonly empty?: string;
  readonly onOpen: (stepId: string) => void;
  readonly steps: readonly GameAdminStep[];
  readonly title?: string;
}) {
  const newestFirst = [...steps].reverse();
  return (
    <ArcadeInfoCard title={title}>
      {newestFirst.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul aria-label="Steps taken">
          {newestFirst.map((step) => (
            <li
              data-delayed={showsDelayed(step) ? "true" : undefined}
              data-step-state={step.state}
              key={step.id}
            >
              <strong>{operationLabel(step)}</strong> —{" "}
              <span>{stepCopy(step).label}</span>
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
