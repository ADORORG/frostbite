import { uploadsNewPath } from "@frostbite/shared/uploads";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadeEmptyState,
  ArcadeFilterTabs,
  ArcadePanel,
  LoadFailureLamp,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState } from "react";

import {
  effectivePurposeFilter,
  purposeFilterOptions,
  visibleAssets,
  type PurposeFilter,
} from "../../client/library-view.ts";
import type { AssetLibrary } from "../hooks/use-asset-library.ts";
import { AssetGrid } from "./asset-grid.tsx";

// The library in every state it can be in. Each state says what is actually known: loading is not
// "empty", and a failed refresh does not hide what was already loaded. A filter narrows the images
// by what they were made for.
export function AssetLibraryPanel({
  library,
}: {
  readonly library: AssetLibrary;
}) {
  const { loadMore, loadingMore, refresh, state } = library;
  const [chosen, setChosen] = useState<PurposeFilter>("all");
  const loaded = state.status === "loading" ? null : state.library;
  const assets = loaded?.assets ?? null;
  const options = purposeFilterOptions(assets ?? []);
  const filter = effectivePurposeFilter(options, chosen);
  return (
    <ArcadePanel eyebrow="Private drafts" title="Your library">
      {state.status === "loading" ? (
        <StatusLamp label="Loading your library…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <LoadFailureLamp
            hasEarlier={assets !== null}
            subject="Your library"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={refresh} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {assets !== null && assets.length === 0 ? (
        <ArcadeEmptyState
          action={
            <ArcadeButton href={uploadsNewPath} tone="mint">
              Upload your first image
            </ArcadeButton>
          }
          title="Nothing uploaded yet"
        >
          Images you upload stay private to you. Add a cover, a banner, or item
          art, then use it in a collection.
        </ArcadeEmptyState>
      ) : null}
      {assets !== null && assets.length > 0 ? (
        <>
          <ArcadeFilterTabs
            label="Show images made for"
            onChange={setChosen}
            options={options}
            value={filter}
          />
          <AssetGrid assets={visibleAssets(assets, filter)} />
        </>
      ) : null}
      {loaded?.nextCursor == null ? null : (
        <div className="arcade-actions">
          <ArcadeActionButton
            disabled={loadingMore}
            onClick={loadMore}
            tone="yellow"
          >
            {loadingMore ? "Loading older images…" : "Load older images"}
          </ArcadeActionButton>
        </div>
      )}
    </ArcadePanel>
  );
}
