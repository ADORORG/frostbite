import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryResponse } from "@ador/shared/uploads";

import type { UploadsClientServices } from "../../client/browser-services.ts";
import { nextLibraryRefreshDelay } from "../../client/library-refresh.ts";

export type AssetLibraryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly library: LibraryResponse }
  // `library` is the last good data, kept so a failed refresh does not blank the screen.
  | { readonly library: LibraryResponse | null; readonly status: "error" };

export interface AssetLibrary {
  readonly refresh: () => void;
  readonly state: AssetLibraryState;
}

// Loads the caller's library and keeps it fresh: it reloads while anything is still processing and
// before signed image URLs expire. A failed reload leaves the last good data on screen.
export function useAssetLibrary(services: UploadsClientServices): AssetLibrary {
  const [state, setState] = useState<AssetLibraryState>({ status: "loading" });
  const lastGood = useRef<LibraryResponse | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    services.api
      .listAssets({ signal: controller.signal })
      .then((library) => {
        if (controller.signal.aborted) return;
        lastGood.current = library;
        setState({ library, status: "ready" });
        const delay = nextLibraryRefreshDelay(
          library.assets,
          services.now(),
          services.policy,
        );
        if (delay !== null) timer = setTimeout(refresh, delay);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ library: lastGood.current, status: "error" });
      });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [services, tick, refresh]);

  return { refresh, state };
}
