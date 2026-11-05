import type { ForwardedKey } from "./protocol-values.ts";

// Plays a key the page forwarded as the keyboard event the game would have had if the key had been pressed in its own frame, on
// `target` (the game's window), where `attachKeys` and a game's own listeners already hear keys. Only the code and whether it is a
// repeat are known: the page passes on nothing else, so nothing typed can be read from it.
export function replayForwardedKey(
  target: Pick<EventTarget, "dispatchEvent">,
  key: ForwardedKey,
): void {
  target.dispatchEvent(
    new KeyboardEvent(key.phase === "down" ? "keydown" : "keyup", {
      bubbles: true,
      cancelable: true,
      code: key.code,
      repeat: key.repeat,
    }),
  );
}
