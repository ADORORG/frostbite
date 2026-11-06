import {
  creatorApplicationStateLabels,
  creatorReviewHref,
  creatorStandingCopy,
  type CreatorReviewQueueItem,
} from "@frostbite/shared/creator-admission";
import { ArcadeBadge, ArcadeButton } from "@repo/ui/arcade";

// The applications in the chosen group, one card each: who, how far along, which submission, and when it was
// sent, with one way in. The words for each state are the ones the collection review queue uses.
export function QueueList({
  items,
}: {
  readonly items: readonly CreatorReviewQueueItem[];
}) {
  return (
    <ul aria-label="Applications" className="arcade-cards">
      {items.map((item) => (
        <li key={item.applicationId}>
          <article className="arcade-card">
            <h3 className="arcade-card__title">{item.displayName}</h3>
            <ArcadeBadge tone={creatorStandingCopy[item.state].tone}>
              {creatorApplicationStateLabels[item.state]}
            </ArcadeBadge>
            <p className="arcade-card__meta">{`Submission ${item.submissionNumber}, sent ${item.submittedAt.slice(0, 10)}`}</p>
            <ArcadeButton
              ariaLabel={`Open ${item.displayName}, submission ${item.submissionNumber}`}
              href={creatorReviewHref(item.applicationId)}
              tone="cyan"
            >
              Open
            </ArcadeButton>
          </article>
        </li>
      ))}
    </ul>
  );
}
