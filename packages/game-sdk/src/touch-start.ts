import { isTouchScreen } from "./touch.ts";

// On a touch screen a tap on the game's screen starts a run: the Start run button is out of sight there (the screen is the whole frame
// and the buttons are kept to a corner), and a button nobody sees is no way to begin. It starts a run only if the button was on offer
// when the finger went down, and had been for a moment, so the tap that ends a run (a late drop, a jump into a pit) does not start the next
// one before the player has seen how the last one ended.
export const restartDelayMs = 700;

export interface TapToStartOptions {
  readonly now?: () => number;
  // Whether the main pointer is a finger; a mouse clicks the button.
  readonly touch?: () => boolean;
}

// Returns a function that stops listening.
export function attachTapToStart(
  screen: HTMLElement,
  start: HTMLButtonElement,
  {
    now = () => performance.now(),
    touch = isTouchScreen,
  }: TapToStartOptions = {},
): () => void {
  const offered = (): boolean => !start.hidden && !start.disabled;
  let since = offered() ? now() : Number.POSITIVE_INFINITY;
  const watch = new MutationObserver(() => {
    if (!offered()) since = Number.POSITIVE_INFINITY;
    else if (since === Number.POSITIVE_INFINITY) since = now();
  });
  watch.observe(start, {
    attributeFilter: ["disabled", "hidden"],
    attributes: true,
  });
  let armed = false;
  const onDown = (): void => {
    armed = touch() && offered() && now() - since >= restartDelayMs;
  };
  const onClick = (): void => {
    if (!armed) return;
    armed = false;
    start.click();
  };
  screen.addEventListener("pointerdown", onDown);
  screen.addEventListener("click", onClick);
  return () => {
    watch.disconnect();
    screen.removeEventListener("pointerdown", onDown);
    screen.removeEventListener("click", onClick);
  };
}
