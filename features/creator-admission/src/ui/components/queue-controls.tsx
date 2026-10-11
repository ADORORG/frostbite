import {
  creatorReviewGroupLabels,
  creatorReviewGroups,
  creatorReviewSortLabels,
  creatorReviewSorts,
  type CreatorReviewGroup,
  type CreatorReviewQueueResponse,
  type CreatorReviewSort,
} from "@ador/shared/creator-admission";
import { ArcadeFilterTabs, ArcadeSelect } from "@repo/ui/arcade";

// The choices that narrow and order the queue. Every group is offered with its size, so a reviewer can see
// where the work is before opening any of it; before the first page arrives the sizes are not known and the
// groups are offered without them.
export function QueueControls({
  counts,
  group,
  onGroup,
  onSort,
  sort,
}: {
  readonly counts: CreatorReviewQueueResponse["counts"] | null;
  readonly group: CreatorReviewGroup;
  readonly onGroup: (group: CreatorReviewGroup) => void;
  readonly onSort: (sort: CreatorReviewSort) => void;
  readonly sort: CreatorReviewSort;
}) {
  return (
    <div className="arcade-form">
      <ArcadeFilterTabs
        label="Show applications that are"
        onChange={onGroup}
        options={creatorReviewGroups.map((value) => ({
          count: counts?.[value] ?? 0,
          label: creatorReviewGroupLabels[value],
          value,
        }))}
        value={group}
      />
      <ArcadeSelect
        label="Sort by"
        onChange={(value) =>
          onSort(
            creatorReviewSorts.find((candidate) => candidate === value) ?? sort,
          )
        }
        options={creatorReviewSorts.map((value) => ({
          label: creatorReviewSortLabels[value],
          value,
        }))}
        value={sort}
      />
    </div>
  );
}
