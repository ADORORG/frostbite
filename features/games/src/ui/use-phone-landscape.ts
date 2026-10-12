import { useSyncExternalStore } from "react";

// A phone held sideways: wide and short with a touch screen. There the game is small and the page around it
// takes most of the height, so full screen is worth offering.
const query =
  "(orientation: landscape) and (max-height: 32rem) and (pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function usePhoneLandscape(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
    () => false,
  );
}
