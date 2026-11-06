import { useSyncExternalStore } from "react";

// Whether a media query matches now, and again whenever it changes. Known only in a browser: the server and the first render say no, so
// the markup agrees on both sides.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}

// A touch screen is the main pointer: a finger, not a mouse.
export const touchScreenQuery = "(pointer: coarse)";
