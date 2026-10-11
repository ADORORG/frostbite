import {
  submissionRequirementCopy,
  submissionRequirements,
  type SubmissionRequirement,
} from "@ador/shared/collections";
import { ArcadeBadge } from "@repo/ui/arcade";

// The three things a collection needs before it can be submitted, each marked ready or still needed,
// in words (colour is never the only signal).
export function ReadinessList({
  missing,
}: {
  readonly missing: readonly SubmissionRequirement[];
}) {
  return (
    <ul aria-label="What this collection needs before it can be submitted">
      {submissionRequirements.map((requirement) => (
        <li key={requirement}>
          {`Has ${submissionRequirementCopy[requirement]}`}{" "}
          {missing.includes(requirement) ? (
            <ArcadeBadge tone="yellow">Still needed</ArcadeBadge>
          ) : (
            <ArcadeBadge tone="mint">Ready</ArcadeBadge>
          )}
        </li>
      ))}
    </ul>
  );
}
