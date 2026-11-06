// Whether the player's main way in is a finger (a phone or a tablet) or a mouse and keyboard, asked each time it matters, so a page
// opened on one and played on the other says the right thing. A browser that cannot tell (or a test page) counts as a keyboard.
// A stand-in for the SDK's `byInput` (`@frostbite/game-sdk/touch`), which the owners' newer `dev` has: switch to it once it is on `dev`.
export const touchFirst = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(pointer: coarse)").matches;

// The words (or anything else) for the way the player plays: the first for a keyboard, the second for a finger.
export const byInput = <Said>(keyboard: Said, touch: Said): Said =>
  touchFirst() ? touch : keyboard;
