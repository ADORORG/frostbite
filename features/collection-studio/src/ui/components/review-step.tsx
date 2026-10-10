import { pickRendition } from "@ador/feature-uploads/presentation";
import type { ChainOption } from "@ador/shared/chain";
import type {
  CollectionDetail,
  CollectionSubmission,
} from "@ador/shared/collections";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadeMediaTile,
  StatusLamp,
} from "@repo/ui/arcade";

import {
  draftChangedSince,
  latestSubmission,
  submitAvailability,
} from "../../client/submission-progress.ts";
import type { Resource } from "../hooks/use-resource.ts";
import { ReadinessList } from "./readiness-list.tsx";
import { SubmissionStatus } from "./submission-status.tsx";
import { SubmitPanel } from "./submit-panel.tsx";

// What the draft holds, whether it can be submitted, and where its submissions stand. The submission
// list loads on its own, so a slow or failed load never hides the summary.
export function ReviewStep({
  busy,
  chains,
  detail,
  listHref,
  onRefresh,
  onSubmit,
  submissions,
  unsaved,
}: {
  readonly busy: boolean;
  readonly chains: readonly ChainOption[];
  readonly detail: CollectionDetail;
  readonly listHref: string;
  readonly onRefresh: () => void;
  readonly onSubmit: () => void;
  readonly submissions: Resource<{
    readonly submissions: readonly CollectionSubmission[];
  }>;
  readonly unsaved: boolean;
}) {
  const { collection, items, previews } = detail;
  const chain = chains.find(
    ({ chainId }) => chainId === collection.targetChain,
  );
  const cover = previews.find(({ id }) => id === collection.coverAssetId);
  const thumbnail =
    cover === undefined
      ? undefined
      : pickRendition(cover.derivatives, "thumbnail");
  const loaded = submissions.status === "loading" ? null : submissions.data;
  const latest = loaded === null ? null : latestSubmission(loaded.submissions);
  const availability = submitAvailability(detail, latest);
  return (
    <div className="arcade-form">
      <ArcadeMediaTile
        caption={
          <>
            <strong>{collection.name}</strong>
            <span>{`${items.length} of ${collection.plannedSupply} items`}</span>
            <span>{chain?.displayName ?? collection.targetChain}</span>
          </>
        }
        image={
          thumbnail === undefined
            ? undefined
            : {
                alt: `Cover image for ${collection.name}`,
                height: thumbnail.heightPixels,
                src: thumbnail.url,
                width: thumbnail.widthPixels,
              }
        }
        placeholder="No cover image yet"
      />
      {availability.kind === "missing" || availability.kind === "ready" ? (
        <ReadinessList
          missing={availability.kind === "missing" ? availability.missing : []}
        />
      ) : null}
      {submissions.status === "loading" ? (
        <StatusLamp label="Loading submissions…" tone="attention" />
      ) : null}
      {submissions.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp
            label="Your submissions could not be loaded."
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={onRefresh} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {latest === null ? null : (
        <SubmissionStatus
          changedSince={draftChangedSince(detail, latest)}
          submission={latest}
        />
      )}
      {loaded === null ? null : (
        <SubmitPanel
          availability={availability}
          busy={busy}
          onSubmit={onSubmit}
          unsaved={unsaved}
        />
      )}
      <div className="arcade-actions">
        <ArcadeButton href={listHref} tone="yellow">
          Back to your collections
        </ArcadeButton>
      </div>
    </div>
  );
}
