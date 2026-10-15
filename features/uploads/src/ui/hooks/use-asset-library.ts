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
  // Fetches the next, older page and adds it to what is shown. Does nothing when there is none or one is on its way.
  readonly loadMore: () => void;
  // Whether an older page is being fetched.
  readonly loadingMore: boolean;
  readonly refresh: () => void;
  readonly state: AssetLibraryState;
}

// Loads the caller's library, a page at a time, and keeps what is loaded fresh: it reloads while anything is still processing
// and before signed image URLs expire, fetching again as many pages as are shown (the older pages' URLs expire too). A failed
// reload leaves the last good data on screen.
export function useAssetLibrary(services: UploadsClientServices): AssetLibrary {
  const [state, setState] = useState<AssetLibraryState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const lastGood = useRef<LibraryResponse | null>(null);
  // How many pages are shown, so a reload fetches as many.
  const pages = useRef(1);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { signal } = controller;
    const load = async (): Promise<LibraryResponse> => {
      let library = await services.api.listAssets({ signal });
      for (
        let page = 1;
        page < pages.current && library.nextCursor !== null;
        page += 1
      ) {
        const older = await services.api.listOlderAssets(library.nextCursor, {
          signal,
        });
        library = {
          assets: [...library.assets, ...older.assets],
          nextCursor: older.nextCursor,
        };
      }
      return library;
    };
    load()
      .then((library) => {
        if (signal.aborted) return;
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
        if (!signal.aborted)
          setState({ library: lastGood.current, status: "error" });
      });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [services, tick, refresh]);

  const loadMore = useCallback(() => {
    const current = lastGood.current;
    if (current?.nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    services.api
      .listOlderAssets(current.nextCursor)
      .then((older) => {
        const shown = lastGood.current;
        // A reload that landed meanwhile has replaced what the cursor continued from; try again from the new state.
        if (shown?.nextCursor !== current.nextCursor) return;
        pages.current += 1;
        const library = {
          assets: [...shown.assets, ...older.assets],
          nextCursor: older.nextCursor,
        };
        lastGood.current = library;
        setState({ library, status: "ready" });
      })
      .catch(() => setState({ library: lastGood.current, status: "error" }))
      .finally(() => setLoadingMore(false));
  }, [services, loadingMore]);

  return { loadMore, loadingMore, refresh, state };
}
