import { uploadsNewPath } from "@ador/shared/uploads";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadeEmptyState,
  ArcadeFilterTabs,
  ArcadePanel,
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
  const { refresh, state } = library;
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
          <StatusLamp
            label={
              assets === null
                ? "Your library could not be loaded."
                : "Could not refresh. Showing what was loaded earlier."
            }
            tone="unavailable"
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
      {loaded?.truncated === true ? (
        <StatusLamp
          label="Showing your newest images. Older ones are not listed yet."
          tone="attention"
        />
      ) : null}
    </ArcadePanel>
  );
}
