import { useEffect, useRef } from "react";

import type { useFullscreen } from "./use-fullscreen.ts";
import type { Theatre } from "./use-theatre.ts";

// What a touch screen gets in place of two buttons: one way to give the game everything. The page steps out of the way (theatre) and, where
// the browser allows it, the browser's own bars go too (full screen). A phone browser that has no full screen still gets the theatre, so the
// one button works everywhere. Leaving is the page's exit chip, or the browser's own gesture, which ends the theatre with it.
export function useImmersive(
  fullscreen: ReturnType<typeof useFullscreen>,
  theatre: Theatre,
) {
  const viaFullscreen = useRef(false);
  const leaveTheatre = theatre.set;
  useEffect(() => {
    const onChange = (): void => {
      if (document.fullscreenElement || !viaFullscreen.current) return;
      viaFullscreen.current = false;
      leaveTheatre(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [leaveTheatre]);
  return {
    enter: () => {
      theatre.set(true);
      if (fullscreen.supported) {
        viaFullscreen.current = true;
        fullscreen.enter();
      }
    },
    leave: () => {
      theatre.set(false);
      viaFullscreen.current = false;
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => undefined);
    },
  };
}

export type Immersive = ReturnType<typeof useImmersive>;
