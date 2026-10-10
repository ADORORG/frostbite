"use client";

import { collectionReviewQueuePath } from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";
import type { IdempotencyKey } from "@ador/shared/http";
import { useRef, useState } from "react";

import {
  parseDecision,
  type DecisionErrors,
  type DecisionForm as Form,
} from "../client/decisions.ts";
import {
  createBrowserServices,
  type ReviewClientServices,
} from "../client/services.ts";
import { DecisionForm } from "./components/decision-form.tsx";
import { EventTimeline } from "./components/event-timeline.tsx";
import { FailureNotice } from "./components/notice.tsx";
import { SnapshotView } from "./components/snapshot-view.tsx";
import { useAction } from "./hooks/use-action.ts";
import { useResource } from "./hooks/use-resource.ts";

export const signInHref = "/account";

// One submission: the version that was frozen, its history, and the decision a reviewer can record
// next. The decision's idempotency key is held until it is recorded, so a retry after a lost response
// cannot record it twice, and is replaced when the decision itself changes.
export function ReviewDetail({
  services: provided,
  submissionId,
}: {
  readonly services?: ReviewClientServices;
  readonly submissionId: string;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const detail = useResource(
    (signal) => services.api.read(submissionId, { signal }),
    submissionId,
  );
  const action = useAction();
  const [errors, setErrors] = useState<DecisionErrors>({});
  const attempt = useRef<{
    readonly key: IdempotencyKey;
    readonly signature: string;
  } | null>(null);
  const { state } = detail;
  const loaded = state.status === "loading" ? null : state.data;

  async function decide(form: Form): Promise<boolean> {
    const parsed = parseDecision(submissionId, form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return false;
    }
    setErrors({});
    const signature = JSON.stringify(parsed.decision);
    if (attempt.current?.signature !== signature)
      attempt.current = { key: services.createIdempotencyKey(), signature };
    const { key } = attempt.current;
    return action.act(async () => {
      const { submission } = await services.api.decide(parsed.decision, {
        idempotencyKey: key,
      });
      attempt.current = null;
      detail.replace({ previews: loaded?.previews ?? [], submission });
    });
  }

  return (
    <ArcadePanel
      eyebrow="Submission"
      title={loaded?.submission.snapshot.collection.name ?? "Submission"}
    >
      {state.status === "loading" ? (
        <StatusLamp label="Loading the submission…" tone="attention" />
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
      {action.notice === null ? null : (
        <FailureNotice
          failure={action.notice}
          onDismiss={action.dismissNotice}
          onReload={() => {
            action.dismissNotice();
            detail.reload();
          }}
          signInHref={signInHref}
        />
      )}
      {loaded === null ? null : (
        <>
          <StatusLamp
            label={`State: ${loaded.submission.state}`}
            tone="attention"
          />
          <SnapshotView
            previews={loaded.previews}
            submission={loaded.submission}
          />
          <DecisionForm
            busy={action.busy}
            errors={errors}
            key={loaded.submission.state}
            onSubmit={decide}
            state={loaded.submission.state}
          />
          <EventTimeline events={loaded.submission.events} />
        </>
      )}
      <div className="arcade-actions">
        <ArcadeButton href={collectionReviewQueuePath} tone="yellow">
          Back to the queue
        </ArcadeButton>
      </div>
    </ArcadePanel>
  );
}
