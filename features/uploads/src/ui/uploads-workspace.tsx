"use client";

import { useCallback, useState } from "react";

import {
  createBrowserServices,
  type UploadsClientServices,
} from "../client/browser-services.ts";
import type { UploadEvent } from "../client/upload-state.ts";
import { AssetLibraryPanel } from "./components/asset-library-panel.tsx";
import { UploadPanel } from "./components/upload-panel.tsx";
import { useAssetLibrary } from "./hooks/use-asset-library.ts";
import { useUploadSession } from "./hooks/use-upload-session.ts";

// Events after which the library has something new to show.
const libraryChangingEvents: readonly UploadEvent["type"][] = [
  "completed",
  "finished",
  "still-processing",
];

// The client composition root: one upload session and one library, wired so that finishing an
// upload refreshes the list. Both panels are plain components that take what they render.
export function UploadsWorkspace({
  services: provided,
}: {
  // Defaults to the browser's own fetch, XHR, crypto, and timers; tests pass fakes.
  readonly services?: UploadsClientServices;
}) {
  const [services] = useState(() => provided ?? createBrowserServices());
  const library = useAssetLibrary(services);
  const { refresh } = library;
  const onEvent = useCallback(
    (event: UploadEvent) => {
      if (libraryChangingEvents.includes(event.type)) refresh();
    },
    [refresh],
  );
  const session = useUploadSession(services, onEvent);
  return (
    <div className="arcade-stack">
      <UploadPanel session={session} />
      <AssetLibraryPanel library={library} />
    </div>
  );
}
