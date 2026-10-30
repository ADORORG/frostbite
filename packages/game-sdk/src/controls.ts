// Keys for a game, the same in every game: Enter starts (and starts again), P pauses and resumes, and a game adds its own, such as
// the arrows or Space. A key maps to an action name; the game says what each action does. Held keys do not repeat, a shortcut with
// Ctrl, Alt or Meta is left to the browser, and typing in a field is left alone.
export type Phase = "down" | "up";

export interface KeyTarget {
  addEventListener(
    type: "keydown" | "keyup",
    listener: (event: KeyboardEvent) => void,
  ): void;
  removeEventListener(
    type: "keydown" | "keyup",
    listener: (event: KeyboardEvent) => void,
  ): void;
}

export const standardKeys = {
  Enter: "start",
  KeyP: "pause",
  NumpadEnter: "start",
} as const;

export type StandardAction = (typeof standardKeys)[keyof typeof standardKeys];

const fieldTags = new Set(["INPUT", "SELECT", "TEXTAREA"]);

function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    (fieldTags.has(target.tagName) ||
      (target instanceof HTMLElement && target.isContentEditable))
  );
}

// The keys and what each does. `keys` may name Enter or P again to change them (for a game that drops with Enter, say), and any other
// key. The handler is told the action and whether the key went down or came up.
export function attachKeys<Action extends string>(
  target: KeyTarget,
  keys: Readonly<Record<string, Action>>,
  on: (action: Action, phase: Phase) => void,
): () => void {
  const table = new Map<string, string>(Object.entries(keys));
  const handle =
    (phase: Phase) =>
    (event: KeyboardEvent): void => {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        typingIn(event.target)
      )
        return;
      const action = keys[event.code];
      if (action === undefined || !table.has(event.code)) return;
      // The page must not scroll, and a focused button must not also be pressed by the same key.
      event.preventDefault();
      if (phase === "down" && event.repeat) return;
      on(action, phase);
    };
  const down = handle("down");
  const up = handle("up");
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
  };
}
