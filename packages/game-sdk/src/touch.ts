// Whether the main pointer is a finger (a phone or a tablet) and not a mouse, as the browser says it now. Where there is no browser to ask
// (a game's drawing run on its own in a test) or it cannot say (a very old one), it is taken to be a mouse.
export const isTouchScreen = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

// What a page says depending on how it is played: the line for a keyboard, or the one for a finger (a line that names Enter means nothing on
// a phone).
export const byInput = (keyboardLine: string, touchLine: string): string =>
  isTouchScreen() ? touchLine : keyboardLine;
