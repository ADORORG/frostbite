"use client";

import { uploadsStudioPath } from "@ador/shared/uploads";
import {
  ArcadeActionButton,
  ArcadeButton,
  ArcadeEmptyState,
  StatusLamp,
} from "@repo/ui/arcade";
import { useEffect, useState } from "react";

import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import { ImageDetails } from "./components/image-details.tsx";
import { useAssetLibrary } from "./hooks/use-asset-library.ts";

// The client composition root of the image page. The library is the only source of an image, so a
// missing image is told apart from one that could not be loaded.
export function ImageDetailWorkspace({
  assetId,
  services: provided,
}: {
  readonly assetId: string;
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const { loadMore, loadingMore, refresh, state } = useAssetLibrary(services);
  const loaded = state.status === "loading" ? null : state.library;
  const asset = loaded?.assets.find(({ id }) => id === assetId);
  // An image older than the newest page is looked for page by page, until it is found or the list ends.
  const searching =
    state.status === "ready" &&
    asset === undefined &&
    state.library.nextCursor !== null;
  useEffect(() => {
    if (searching && !loadingMore) loadMore();
  }, [searching, loadingMore, loadMore]);
  return (
    <div className="arcade-stack">
      {state.status === "loading" || searching ? (
        <StatusLamp label="Loading the image…" tone="attention" />
      ) : null}
      {state.status === "error" ? (
        <div className="arcade-form">
          <StatusLamp
            label="The image could not be loaded."
            tone="unavailable"
          />
          <div className="arcade-actions">
            <ArcadeActionButton onClick={refresh} tone="yellow">
              Retry
            </ArcadeActionButton>
          </div>
        </div>
      ) : null}
      {asset === undefined ? null : <ImageDetails asset={asset} />}
      {loaded !== null && asset === undefined && !searching ? (
        <ArcadeEmptyState
          action={
            <ArcadeButton href={uploadsStudioPath} tone="mint">
              Back to your library
            </ArcadeButton>
          }
          title="Image not found"
        >
          It is not in your library. It may belong to another account, or it no
          longer exists.
        </ArcadeEmptyState>
      ) : null}
    </div>
  );
}
