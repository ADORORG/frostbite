import { ArcadeActionButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import type { AssetLibrary } from "../hooks/use-asset-library.ts";
import { AssetGrid } from "./asset-grid.tsx";

// The library in every state it can be in. Each state says what is actually known: loading is not
// "empty", and a failed refresh does not hide what was already loaded.
export function AssetLibraryPanel({
  library,
}: {
  readonly library: AssetLibrary;
}) {
  const { refresh, state } = library;
  const loaded = state.status === "loading" ? null : state.library;
  const assets = loaded?.assets ?? null;
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
        <StatusLamp
          label="Nothing uploaded yet. Your images will appear here."
          tone="attention"
        />
      ) : null}
      {assets !== null && assets.length > 0 ? (
        <AssetGrid assets={assets} />
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
