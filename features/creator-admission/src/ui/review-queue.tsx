"use client";

import {
  creatorReviewGroupLabels,
  type CreatorReviewGroup,
} from "@ador/shared/creator-admission";
import {
  ArcadeActionButton,
  ArcadeEmptyState,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type ReviewClientServices,
} from "../client/services.ts";
import { QueueControls } from "./components/queue-controls.tsx";
import { QueueList } from "./components/queue-list.tsx";
import { useReviewQueue } from "./hooks/use-review-queue.ts";

// What an empty group says: nothing is waiting is good news, not a fault.
const emptyCopy: Readonly<Record<CreatorReviewGroup, string>> = {
  active: "No application is approved or paused.",
  all: "No application has been sent yet.",
  finished: "No application has been finished yet.",
  "needs-review": "Nothing is waiting for review.",
};

// The client composition root of the creator review queue: choose a group and an order, read the list, ask
// for more. Loading is not "empty", and a failed refresh does not hide what was already loaded.
export function ReviewQueue({
  services: provided,
}: {
  readonly services?: ReviewClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const queue = useReviewQueue(services);
  const { state } = queue.first;
  const loaded = state.status === "loading" ? null : state.data;
  return (
    <div className="arcade-stack">
      <QueueControls
        counts={loaded?.counts ?? null}
        group={queue.group}
        onGroup={queue.setGroup}
        onSort={queue.setSort}
        sort={queue.sort}
      />
      {state.status === "loading" ? (
        <StatusLamp label="Loading applications…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp
            label={
              loaded === null
                ? "The applications could not be loaded."
                : "Could not refresh. Showing what was loaded earlier."
            }
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={queue.first.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {loaded !== null && queue.items.length === 0 ? (
        <ArcadeEmptyState title={creatorReviewGroupLabels[queue.group]}>
          {emptyCopy[queue.group]}
        </ArcadeEmptyState>
      ) : null}
      {queue.items.length > 0 ? <QueueList items={queue.items} /> : null}
      {queue.action.notice === null ? null : (
        <div className="arcade-form">
          <StatusLamp label={queue.action.notice.message} tone="unavailable" />
          <div className="arcade-actions">
            <ArcadeActionButton
              onClick={queue.action.dismissNotice}
              tone="cyan"
            >
              Dismiss and try again
            </ArcadeActionButton>
          </div>
        </div>
      )}
      {queue.hasMore ? (
        <div className="arcade-actions">
          <ArcadeActionButton
            disabled={queue.action.busy}
            onClick={() => void queue.loadMore()}
            tone="cyan"
          >
            Load more applications
          </ArcadeActionButton>
        </div>
      ) : null}
    </div>
  );
}
