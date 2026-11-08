import type { ListGalleryMintsResponse } from "@frostbite/shared/games";
import { useCallback, useEffect, useState } from "react";

import { createGalleryApi, type GalleryApi } from "../client/gallery-api.ts";

type Mint = ListGalleryMintsResponse["mints"][number];
type Counts = NonNullable<ListGalleryMintsResponse["counts"]>;

// What the gallery knows: asking for the first page, the mints so far (with the per-milestone counts, and whether more are being asked
// for, or failed to come), or that the platform could not be reached.
export type GalleryState =
  | { readonly kind: "failed" }
  | { readonly kind: "loading" }
  | {
      readonly counts: Counts;
      readonly kind: "ready";
      readonly mints: readonly Mint[];
      readonly more: "failed" | "idle" | "loading" | "none";
    };

// The gallery is of one game for as long as it is on screen: a page of another game makes its own (it is keyed by the game).
export function useGallery(gameId: string, api?: GalleryApi) {
  const [state, setState] = useState<GalleryState>({ kind: "loading" });
  const [next, setNext] = useState<string | null>(null);
  const source = useCallback(() => api ?? createGalleryApi(), [api]);
  useEffect(() => {
    let current = true;
    source()
      .list(gameId)
      .then((page) => {
        if (!current) return;
        setNext(page.next);
        setState({
          counts: page.counts ?? [],
          kind: "ready",
          mints: page.mints,
          more: page.next === null ? "none" : "idle",
        });
      })
      .catch(() => current && setState({ kind: "failed" }));
    return () => {
      current = false;
    };
  }, [gameId, source]);
  const loadMore = useCallback(() => {
    if (next === null) return;
    setState((now) =>
      now.kind === "ready" ? { ...now, more: "loading" } : now,
    );
    source()
      .list(gameId, next)
      .then((page) => {
        setNext(page.next);
        setState((now) =>
          now.kind === "ready"
            ? {
                ...now,
                mints: [...now.mints, ...page.mints],
                more: page.next === null ? "none" : "idle",
              }
            : now,
        );
      })
      .catch(() =>
        setState((now) =>
          now.kind === "ready" ? { ...now, more: "failed" } : now,
        ),
      );
  }, [gameId, next, source]);
  return { loadMore, state };
}
