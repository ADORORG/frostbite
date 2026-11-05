"use client";

import { uploadsNewPath } from "@frostbite/shared/uploads";
import { ArcadeButton } from "@repo/ui/arcade";
import { useState } from "react";

import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import { AssetLibraryPanel } from "./components/asset-library-panel.tsx";
import { useAssetLibrary } from "./hooks/use-asset-library.ts";

// The client composition root of the library page: the creator's images, and the way to add one.
export function LibraryWorkspace({
  services: provided,
}: {
  // Defaults to the browser's own fetch, XHR, crypto, and timers; tests pass fakes.
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const library = useAssetLibrary(services);
  return (
    <div className="arcade-stack">
      <div className="page-actions">
        <ArcadeButton href={uploadsNewPath} tone="mint">
          Upload an image
        </ArcadeButton>
      </div>
      <AssetLibraryPanel library={library} />
    </div>
  );
}
