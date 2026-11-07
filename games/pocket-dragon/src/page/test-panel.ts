import { keyMatches } from "../test-mode/key.ts";
import { element } from "./elements.ts";

// The admin's way into test mode. Holding the game's title down for two seconds (a mouse button or a finger) opens a small dialog that
// asks for the admin's key; the right key turns test mode on for this visit only, and nothing remembers it. The badge it shows over the
// page leads back out. What test mode does to a run is in `src/test-mode/`.
export const holdMs = 2_000;

export const testNote =
  "Test mode: hearts are never lost and the rocket never leaves, and nothing is timed, scored, saved or sent.";
export const testOverNote = "That test run is over: nothing in it was counted.";

export interface TestPanel {
  close(): void;
  isOpen(): boolean;
  open(): void;
}

export interface TestPanelOptions {
  // Whether a typed key is the admin's (slow on purpose).
  readonly check: (key: string) => Promise<boolean>;
  readonly unlocked: () => void;
}

export function createTestPanel(options: TestPanelOptions): TestPanel {
  const root = element("test-panel", "div");
  const input = element("test-key", "input");
  const message = element("test-message", "p");
  const unlock = element("test-unlock", "button");
  const cancel = element("test-cancel", "button");
  const main = document.querySelector("main");
  let checking = false;

  function close(): void {
    root.hidden = true;
    input.value = "";
    message.textContent = "";
    main?.removeAttribute("inert");
  }

  async function tryKey(): Promise<void> {
    if (checking) return;
    checking = true;
    unlock.disabled = true;
    message.textContent = "Checking the key…";
    const right = await options.check(input.value).catch(() => false);
    checking = false;
    unlock.disabled = false;
    if (!right) {
      message.textContent = "That key does not unlock test mode.";
      input.select();
      return;
    }
    close();
    options.unlocked();
  }

  // Keys pressed in the dialog are the dialog's: the game's keys must not take them.
  const ownKeys = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.type !== "keydown") return;
    if (event.key === "Escape") close();
    if (event.key === "Enter" && event.target === input) {
      event.preventDefault();
      void tryKey();
    }
  };
  root.addEventListener("keydown", ownKeys);
  root.addEventListener("keyup", ownKeys);
  unlock.addEventListener("click", () => void tryKey());
  cancel.addEventListener("click", close);

  return {
    close,
    isOpen: () => !root.hidden,
    open() {
      root.hidden = false;
      message.textContent = "";
      main?.setAttribute("inert", "");
      input.focus();
    },
  };
}

// Calls `then` once a press on `target` has been held for `ms` milliseconds; letting go or moving off sooner does nothing. Returns a
// function that stops listening.
export function holdToOpen(
  target: HTMLElement,
  then: () => void,
  ms = holdMs,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const start = (event: PointerEvent): void => {
    stop();
    if (event.button !== 0) return;
    timer = setTimeout(() => {
      timer = null;
      then();
    }, ms);
  };
  // A long press on a touch screen would otherwise bring up the browser's own menu.
  const menu = (event: Event): void => event.preventDefault();
  const ends = ["pointerup", "pointerleave", "pointercancel"] as const;
  target.addEventListener("pointerdown", start);
  target.addEventListener("contextmenu", menu);
  for (const type of ends) target.addEventListener(type, stop);
  return () => {
    stop();
    target.removeEventListener("pointerdown", start);
    target.removeEventListener("contextmenu", menu);
    for (const type of ends) target.removeEventListener(type, stop);
  };
}

export interface TestMode {
  // Whether the key dialog is open over the page.
  readonly isOpen: () => boolean;
  // Whether test mode is on.
  readonly on: () => boolean;
}

// Test mode on the page: the title held down opens the dialog (when `canOpen` says it may), the right key turns test mode on, and the
// badge's button turns it off; `changed` is told each time.
export function attachTestMode(options: {
  readonly canOpen: () => boolean;
  readonly changed: (on: boolean) => void;
}): TestMode {
  let on = false;
  const set = (value: boolean): void => {
    on = value;
    options.changed(value);
  };
  const panel = createTestPanel({
    check: keyMatches,
    unlocked: () => set(true),
  });
  holdToOpen(element("title", "h1"), () => {
    if (!on && options.canOpen()) panel.open();
  });
  element("test-leave", "button").addEventListener("click", () => set(false));
  return { isOpen: panel.isOpen, on: () => on };
}
