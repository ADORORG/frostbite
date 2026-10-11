import {
  collectionReviewHref,
  submissionActionPastLabels,
  submissionStateLabels,
  type ReviewActivityItem,
} from "@ador/shared/collections";
import { ArcadeBadge, ArcadeButton } from "@repo/ui/arcade";

// The events, newest first, each as a sentence: who did what to which submission, when, and the state
// it left the submission in. The submission's own page has the feedback and private notes.
export function ActivityList({
  items,
}: {
  readonly items: readonly ReviewActivityItem[];
}) {
  return (
    <ol aria-label="Review activity" className="arcade-form">
      {items.map((item) => (
        <li key={item.eventId}>
          <p>
            <strong>{item.actorName}</strong>{" "}
            {`${submissionActionPastLabels[item.action]} ${item.collectionName}, submission ${String(item.sequence)}`}
          </p>
          <p>
            <small>
              {`${item.createdAt.slice(0, 16).replace("T", " ")} UTC · ${item.reasonCode}`}
            </small>{" "}
            <ArcadeBadge tone="cyan">
              {submissionStateLabels[item.nextState]}
            </ArcadeBadge>
          </p>
          <ArcadeButton
            href={collectionReviewHref(item.submissionId)}
            tone="mint"
          >
            {`Open ${item.collectionName}, submission ${String(item.sequence)}`}
          </ArcadeButton>
        </li>
      ))}
    </ol>
  );
}
