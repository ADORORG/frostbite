import {
  collectionReviewHref,
  submissionStateLabels,
  type ReviewQueueResponse,
} from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeBadge,
  ArcadeButton,
  StatusLamp,
} from "@repo/ui/arcade";

import type { LoadedResource } from "../hooks/use-resource.ts";

// The submissions in the chosen group, oldest update first. Loading is not "empty", and a failed
// refresh does not hide what was already loaded.
export function QueueList({
  list,
}: {
  readonly list: LoadedResource<ReviewQueueResponse>;
}) {
  const { state } = list;
  const items = state.status === "loading" ? null : (state.data?.items ?? null);
  return (
    <section aria-label="Submissions" className="arcade-form">
      {state.status === "loading" ? (
        <StatusLamp label="Loading submissions…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <>
          <StatusLamp
            label={
              items === null
                ? "The submissions could not be loaded."
                : "Could not refresh. Showing what was loaded earlier."
            }
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={list.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </>
      ) : null}
      {items !== null && items.length === 0 ? (
        <StatusLamp label="Nothing here right now." tone="attention" />
      ) : null}
      {items !== null && items.length > 0 ? (
        <ul aria-label="Submissions" className="arcade-grid">
          {items.map((item) => (
            <li key={item.id}>
              <article className="arcade-media-tile">
                <h3>{item.collectionName}</h3>
                <p>{`Submission ${String(item.sequence)}`}</p>
                <ArcadeBadge tone="cyan">
                  {submissionStateLabels[item.state]}
                </ArcadeBadge>
                <p>{`Updated ${item.updatedAt.slice(0, 10)}`}</p>
                <ArcadeButton href={collectionReviewHref(item.id)} tone="mint">
                  {`Open ${item.collectionName}, submission ${String(item.sequence)}`}
                </ArcadeButton>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
