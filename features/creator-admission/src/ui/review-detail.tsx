"use client";

import {
  creatorApplicationStateLabels,
  creatorReviewPath,
} from "@frostbite/shared/creator-admission";
import { ArcadeActionButton, ArcadeButton, StatusLamp } from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type ReviewClientServices,
} from "../client/services.ts";
import { SentApplication } from "./application-status.tsx";
import { History } from "./components/history.tsx";
import { useResource } from "./hooks/use-resource.ts";
import { ReviewerForm } from "./reviewer-form.tsx";

// One application: the version that was sent (what a decision is about), the decision a reviewer can take
// next, and everything that happened so far. A decision is read back, so the page always shows what the
// server holds.
export function ReviewDetail({
  applicationId,
  services: provided,
}: {
  readonly applicationId: string;
  readonly services?: ReviewClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const detail = useResource(
    (signal) => services.api.read(applicationId, { signal }),
    applicationId,
  );
  const { state } = detail;
  const loaded =
    state.status === "loading" ? null : (state.data?.application ?? null);
  return (
    <div className="arcade-stack">
      {state.status === "loading" ? (
        <StatusLamp label="Loading the application…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp label={state.failure.message} tone="unavailable" />
          {state.failure.retryable ? (
            <div className="arcade-actions">
              <ArcadeActionButton onClick={detail.reload} tone="yellow">
                Retry
              </ArcadeActionButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {loaded === null ? null : (
        <>
          <header className="arcade-stack arcade-stack--tight">
            <h2>{loaded.snapshot.displayName}</h2>
            <StatusLamp
              label={`Status: ${creatorApplicationStateLabels[loaded.state]}, submission ${loaded.submissionNumber}`}
              tone="attention"
            />
          </header>
          <div className="arcade-columns">
            <div className="arcade-stack">
              <SentApplication
                draft={loaded.snapshot}
                heading="What the applicant sent"
              />
              <section
                aria-label="History"
                className="arcade-stack arcade-stack--tight"
              >
                <h3>History</h3>
                <History events={loaded.events} />
              </section>
            </div>
            <ReviewerForm
              applicationId={loaded.applicationId}
              key={loaded.state}
              onDecided={detail.reload}
              state={loaded.state}
            />
          </div>
        </>
      )}
      <div className="arcade-actions">
        <ArcadeButton href={creatorReviewPath} tone="yellow">
          Back to the queue
        </ArcadeButton>
      </div>
    </div>
  );
}
