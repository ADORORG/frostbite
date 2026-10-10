"use client";

import { collectionReviewQueuePath } from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type ReviewClientServices,
} from "../client/services.ts";
import { ActivityList } from "./components/activity-list.tsx";
import { FailureNotice } from "./components/notice.tsx";
import { useActivity } from "./hooks/use-activity.ts";
import { signInHref } from "./review-detail.tsx";

// The activity log page: every review event across every submission, newest first, with older events a
// click away. Loading is not "empty", and a failed refresh does not hide what was already loaded.
export function ReviewActivity({
  services: provided,
}: {
  readonly services?: ReviewClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const activity = useActivity(services);
  const { state } = activity.latest;
  const loaded = state.status === "loading" ? null : state.data;
  return (
    <ArcadePanel eyebrow="Audit" title="Review activity">
      {state.status === "loading" ? (
        <StatusLamp label="Loading activity…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp
            label={
              loaded === null
                ? "The activity could not be loaded."
                : "Could not refresh. Showing what was loaded earlier."
            }
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={activity.latest.reload} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {loaded !== null && activity.items.length === 0 ? (
        <StatusLamp label="Nothing has happened yet." tone="attention" />
      ) : null}
      {activity.items.length > 0 ? (
        <ActivityList items={activity.items} />
      ) : null}
      {activity.action.notice === null ? null : (
        <FailureNotice
          failure={activity.action.notice}
          onDismiss={activity.action.dismissNotice}
          onReload={activity.latest.reload}
          signInHref={signInHref}
        />
      )}
      <div className="arcade-actions">
        {activity.hasOlder ? (
          <ArcadeActionButton
            disabled={activity.action.busy}
            onClick={() => void activity.loadOlder()}
            tone="cyan"
          >
            Load older activity
          </ArcadeActionButton>
        ) : null}
        <ArcadeButton href={collectionReviewQueuePath} tone="yellow">
          Back to the queue
        </ArcadeButton>
      </div>
    </ArcadePanel>
  );
}
