import { useMediaQuery } from "./use-media-query.ts";

// A phone held sideways: wide and short with a touch screen. There the game is small and the page around it
// takes most of the height, so full screen is worth offering.
const query =
  "(orientation: landscape) and (max-height: 32rem) and (pointer: coarse)";

export const usePhoneLandscape = (): boolean => useMediaQuery(query);
