import { forwardableKeyCode, type ForwardedKey } from "./protocol-values.ts";

// The host side of `key.forwarded`: which keys a page that frames a game passes on before the player has clicked into it, and the listeners
// that do it. The platform's game page and the local test page both use this, so a key behaves the same while a game is built as when it
// is played. The game's side is `replayForwardedKey` (forwarded-keys.ts).

interface KeyFacts {
  readonly altKey: boolean;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly defaultPrevented: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly type: string;
}

// Keys that scroll the page when nothing is focused. A game uses them to play, so once the page has handed one to the game it must not
// also scroll.
export const scrollingKey = /^(?:Space|Arrow(?:Up|Down|Left|Right))$/u;

// Whether a key press is for the game though the player has not clicked into it. Only when nothing on the page has the keyboard (the
// page itself is focused, so the key would otherwise do nothing), never with a shortcut modifier, never for a key another handler on
// the page already used, and only for the keys the protocol allows (not Tab, which walks the page from its skip link, nor Escape,
// which leaves theatre). A control, a field, an open dialog or the game's own frame that has focus keeps its keys.
export function forwardedKeyOf(
  event: KeyFacts,
  focused: Element | null,
): ForwardedKey | null {
  const nothingFocused =
    focused === null ||
    focused === document.body ||
    focused === document.documentElement;
  if (!nothingFocused) return null;
  // A modal dialog is open (the claim review, the wallet chooser): clicking its text can leave nothing focused, and its keys are its own.
  if (document.querySelector("dialog[open]") !== null) return null;
  if (event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented)
    return null;
  if (!forwardableKeyCode.test(event.code)) return null;
  return {
    code: event.code,
    phase: event.type === "keydown" ? "down" : "up",
    repeat: event.repeat,
  };
}

// Passes on the keys the player presses while nothing on the page has the keyboard, to `send` (the page tells the game with
// `key.forwarded`), and keeps the page from scrolling once it has handed a scrolling key to the game. Returns what stops it.
export function forwardPageKeys(
  document: Document,
  send: (key: ForwardedKey) => void,
): () => void {
  const forward = (event: KeyboardEvent) => {
    const key = forwardedKeyOf(event, document.activeElement);
    if (key === null) return;
    send(key);
    if (scrollingKey.test(key.code)) event.preventDefault();
  };
  document.addEventListener("keydown", forward);
  document.addEventListener("keyup", forward);
  return () => {
    document.removeEventListener("keydown", forward);
    document.removeEventListener("keyup", forward);
  };
}
