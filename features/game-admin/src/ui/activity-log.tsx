import type { GameAdminStep } from "@frostbite/shared/games";
import { ArcadeBadge, SectionBlock } from "@repo/ui/arcade";

import {
  operationLabel,
  showsDelayed,
  stateTone,
  stepCopy,
} from "../domain/copy.ts";
import { shortTime } from "../domain/facts.ts";

const who = (name: string | null): string =>
  name ?? "an account that no longer exists";

// The log of what staff did (to a game's contract, or publishing templates), newest first: what each step was, where it stands, when
// it was built, who built it and who sent it. It is the record that pausing and defining are reviewed from; a row opens its step.
export function ActivityLog({
  empty = "Nothing has been done to this game's contract yet.",
  onOpen,
  steps,
  title = "Activity",
}: {
  // What the log says while it is empty.
  readonly empty?: string;
  readonly onOpen: (stepId: string) => void;
  readonly steps: readonly GameAdminStep[];
  readonly title?: string;
}) {
  const newestFirst = [...steps].reverse();
  return (
    <SectionBlock title={title}>
      {newestFirst.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul aria-label="Steps taken" className="activity">
          {newestFirst.map((step) => (
            <li
              data-delayed={showsDelayed(step) ? "true" : undefined}
              data-step-state={step.state}
              key={step.id}
            >
              <div className="activity__what">
                <strong>{operationLabel(step)}</strong>
                <ArcadeBadge tone={stateTone[step.state]}>
                  {stepCopy(step).label}
                </ArcadeBadge>
              </div>
              <small className="activity__meta">
                {`${shortTime(step.createdAt)} · built by ${who(step.createdBy)}${
                  step.submittedBy === null
                    ? ""
                    : ` · sent by ${who(step.submittedBy)}`
                }`}
              </small>
              <button
                className="activity__open"
                onClick={() => onOpen(step.id)}
                type="button"
              >
                Details
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
}
