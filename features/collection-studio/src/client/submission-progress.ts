import {
  liveSubmissionStates,
  type CollectionDetail,
  type CollectionSubmission,
  type SubmissionRequirement,
  missingSubmissionRequirements,
} from "@ador/shared/collections";

// What the creator can do about submitting, from the collection and its latest submission. This
// mirrors the server's rules to explain them in advance; the server stays the authority.
export type SubmitAvailability =
  | { readonly kind: "ready"; readonly again: boolean }
  | {
      readonly kind: "missing";
      readonly missing: readonly SubmissionRequirement[];
    }
  | { readonly kind: "live" }
  | { readonly kind: "closed" };

// `submissions` is newest first, as the API returns it.
export function latestSubmission(
  submissions: readonly CollectionSubmission[],
): CollectionSubmission | null {
  return submissions[0] ?? null;
}

export function submitAvailability(
  detail: CollectionDetail,
  latest: CollectionSubmission | null,
): SubmitAvailability {
  if (
    latest !== null &&
    liveSubmissionStates.some((live) => live === latest.state)
  )
    return { kind: "live" };
  if (latest !== null && latest.state !== "changes-requested")
    return { kind: "closed" };
  const missing = missingSubmissionRequirements({
    collection: detail.collection,
    itemCount: detail.items.length,
  });
  return missing.length > 0
    ? { kind: "missing", missing }
    : { again: latest !== null, kind: "ready" };
}

// True when the draft has moved on since the version that was submitted, so what the reviewer sees is
// not what the creator now has.
export function draftChangedSince(
  detail: CollectionDetail,
  submission: CollectionSubmission,
): boolean {
  return detail.collection.revision > submission.collectionRevision;
}
