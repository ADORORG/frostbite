// What a swap cleared is flashed on the screen for this long. It is for the eye only, and no rule reads it.
export const flashMs = 260;

// A flash that shows some cells and then, `flashMs` later, calls `clear` (a newer flash replaces the one still showing). Nothing in the rules
// depends on it, so it may be as slow or as fast as the page is.
export function createFlash(clear: () => void): {
  readonly show: () => void;
  readonly stop: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    show() {
      clearTimeout(timer);
      timer = setTimeout(clear, flashMs);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}
