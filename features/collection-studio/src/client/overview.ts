import {
  collectionStandingLabels,
  collectionStandings,
  standingOf,
  submissionStateLabels,
  type CollectionStanding,
  type CollectionSummary,
} from "@ador/shared/collections";
import type { FilterOption } from "@repo/ui/arcade";
import type { ArcadeTone } from "@repo/ui/arcade";

// What the overview shows and says about each collection. Pure, so every filter and every word is
// tested without a screen.

export type StandingFilter = "all" | CollectionStanding;

// "All" always; each standing only while some collection has it, so there are no tabs that lead nowhere.
export function filterOptions(
  collections: readonly CollectionSummary[],
): readonly FilterOption<StandingFilter>[] {
  const counts = new Map<CollectionStanding, number>();
  for (const { submissionState } of collections) {
    const standing = standingOf(submissionState);
    counts.set(standing, (counts.get(standing) ?? 0) + 1);
  }
  return [
    { count: collections.length, label: "All", value: "all" },
    ...collectionStandings.flatMap((standing) => {
      const count = counts.get(standing) ?? 0;
      return count === 0
        ? []
        : [
            {
              count,
              label: collectionStandingLabels[standing],
              value: standing,
            },
          ];
    }),
  ];
}

export function visibleCollections(
  collections: readonly CollectionSummary[],
  filter: StandingFilter,
): readonly CollectionSummary[] {
  return filter === "all"
    ? collections
    : collections.filter(
        ({ submissionState }) => standingOf(submissionState) === filter,
      );
}

// The chosen filter, unless it no longer matches anything (the list reloaded and the last collection
// of that kind moved on), in which case everything is shown.
export function effectiveFilter(
  options: readonly FilterOption<StandingFilter>[],
  chosen: StandingFilter,
): StandingFilter {
  return options.some(({ value }) => value === chosen) ? chosen : "all";
}

export const nextActionLabels: Readonly<Record<CollectionStanding, string>> = {
  approved: "View",
  closed: "See details",
  draft: "Continue editing",
  "in-review": "See status",
  "needs-changes": "Make changes",
};

export const standingTones: Readonly<Record<CollectionStanding, ArcadeTone>> = {
  approved: "mint",
  closed: "red",
  draft: "yellow",
  "in-review": "cyan",
  "needs-changes": "pink",
};

// A draft has no submission to name, so it is simply a draft.
export function stateLabel(summary: CollectionSummary): string {
  return summary.submissionState === null
    ? "Draft"
    : submissionStateLabels[summary.submissionState];
}
