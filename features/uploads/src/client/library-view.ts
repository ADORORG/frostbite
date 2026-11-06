import {
  uploadPurposes,
  type LibraryAsset,
  type UploadPurpose,
} from "@frostbite/shared/uploads";
import type { FilterOption } from "@repo/ui/arcade";

import { purposeLabels } from "./purpose-labels.ts";

// What the library page shows of the images it holds. Pure, so every filter is tested without a screen.
export type PurposeFilter = "all" | UploadPurpose;

// "All" always; each purpose only while some image has it, so there are no tabs that lead nowhere.
export function purposeFilterOptions(
  assets: readonly LibraryAsset[],
): readonly FilterOption<PurposeFilter>[] {
  return [
    { count: assets.length, label: "All", value: "all" },
    ...uploadPurposes.flatMap((purpose) => {
      const count = assets.filter((asset) => asset.purpose === purpose).length;
      return count === 0
        ? []
        : [{ count, label: purposeLabels[purpose], value: purpose }];
    }),
  ];
}

export function visibleAssets(
  assets: readonly LibraryAsset[],
  filter: PurposeFilter,
): readonly LibraryAsset[] {
  return filter === "all"
    ? assets
    : assets.filter((asset) => asset.purpose === filter);
}

// The chosen filter, unless nothing matches it any more (the list reloaded), in which case all are shown.
export function effectivePurposeFilter(
  options: readonly FilterOption<PurposeFilter>[],
  chosen: PurposeFilter,
): PurposeFilter {
  return options.some(({ value }) => value === chosen) ? chosen : "all";
}

// Only a finished image can be used; one still being checked, or refused, has nowhere to go yet.
export function canUseInCollection(asset: LibraryAsset): boolean {
  return asset.processingState === "processed";
}
