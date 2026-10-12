import { useState, useSyncExternalStore, type RefObject } from "react";

const never = () => () => undefined;

// Full screen for one element (the game's frame). The browser decides whether it is allowed: the choice is
// offered only where it says it is (`fullscreenEnabled`), and a refusal is reported, not hidden. There is no way
// back to offer on the page: the frame then covers the whole screen, so leaving is the browser's own (Escape),
// which the browser says on entering. The frame's `allow="fullscreen"` also lets a game's own page ask for it.
export function useFullscreen(target: RefObject<HTMLElement | null>) {
  // Known only in a browser: the server and the first render say no, so the markup agrees on both sides.
  const supported = useSyncExternalStore(
    never,
    () => document.fullscreenEnabled,
    () => false,
  );
  const [refused, setRefused] = useState(false);

  const enter = () => {
    setRefused(false);
    void target.current?.requestFullscreen().catch(() => setRefused(true));
  };

  return { enter, refused, supported };
}
