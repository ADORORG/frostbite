"use client";

import { useEffect, useRef } from "react";

const property = "--arcade-header-height";

// The header wraps its buttons onto a second row on a narrow phone, so it is taller there than the token says, and everything sized "the
// window less the header" (a game's stage, a menu, a sign-in page) ran under whatever lay below. This sits in the header, measures it, and
// sets the token on the shell to what it truly is, for as long as the page is shown. Before the page's code runs the token's own value
// stands, which is right wherever the header does not wrap.
export function HeaderHeight() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const header = marker.current?.parentElement;
    const shell = header?.parentElement;
    if (!header || !shell) return;
    const apply = (): void => {
      const height = header.getBoundingClientRect().height;
      if (height > 0) shell.style.setProperty(property, `${String(height)}px`);
    };
    apply();
    // Without an observer of boxes the window's own resizing is the next best thing.
    const watcher =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    watcher?.observe(header);
    window.addEventListener("resize", apply);
    return () => {
      watcher?.disconnect();
      window.removeEventListener("resize", apply);
      shell.style.removeProperty(property);
    };
  }, []);
  return <span hidden ref={marker} />;
}
