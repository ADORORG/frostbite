// A few action buttons drawn over the screen, for a game whose hands need more than the screen itself gives (a fire button, a special move). A
// pad of a dozen buttons under the screen leaves no room for the screen on a phone; this is a small cluster in the bottom right corner, shown on a
// touch screen only (`phone.css`), with only the buttons taking touches, so a finger anywhere else is a finger on the screen. The buttons are
// not children of the screen, so a finger that lands on one never reaches the screen's zones (`attachZones`), and the reverse.
// A button is held from the finger going down to it coming up, however far it slides in between (it is captured), and two fingers on two buttons
// hold two. A game with more actions than fit gives the rest to a button that cycles them, or to its keys.
export const maxTouchButtons = 4;

export interface TouchButton {
  // What a screen reader says, and what the button shows: a word or two, since the button is a thumb wide.
  readonly label: string;
  // The action begins (a finger lands, or Enter or Space on a focused button).
  readonly press: () => void;
  // The action ends (the last finger on it lifts, is cancelled, or the page loses focus). Called once for each `press`.
  readonly release: () => void;
}

// Draws the buttons into `parent`, which is the page's `main` (the element `phone.css` lays out, and that holds the screen), and listens for
// them. Returns a function that removes them and lets go of every button held.
export function attachTouchButtons(
  parent: HTMLElement,
  buttons: readonly TouchButton[],
): () => void {
  if (parent.tagName !== "MAIN")
    throw new Error("The touch buttons go in the page's main element.");
  if (buttons.length === 0 || buttons.length > maxTouchButtons)
    throw new Error(
      `A game has 1 to ${String(maxTouchButtons)} touch buttons, not ${String(buttons.length)}.`,
    );
  const cluster = parent.ownerDocument.createElement("div");
  cluster.className = "touch-buttons";
  const fingers = new Map<number, number>();
  const down = new Set<number>();
  const letGo = (which: number): void => {
    if (!down.delete(which)) return;
    buttons[which]?.release();
  };
  const elements = buttons.map((button, which) => {
    const element = parent.ownerDocument.createElement("button");
    element.type = "button";
    element.textContent = button.label;
    element.setAttribute("aria-label", button.label);
    element.addEventListener("pointerdown", (event) => {
      // A finger, a pen or the main button of a mouse; not the others (a right click is not a press).
      if (event.button !== 0) return;
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      fingers.set(event.pointerId, which);
      if (!down.has(which)) {
        down.add(which);
        button.press();
      }
    });
    const lift = (event: PointerEvent): void => {
      if (fingers.get(event.pointerId) !== which) return;
      fingers.delete(event.pointerId);
      const stillHeld = [...fingers.values()].includes(which);
      if (!stillHeld) letGo(which);
    };
    element.addEventListener("pointerup", lift);
    element.addEventListener("pointercancel", lift);
    // A keyboard (or a screen reader) activates a focused button with a click that no pointer began: a press and a release.
    element.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      button.press();
      button.release();
    });
    return element;
  });
  cluster.append(...elements);
  parent.append(cluster);
  const letGoOfAll = (): void => {
    fingers.clear();
    for (const which of [...down]) letGo(which);
  };
  parent.ownerDocument.defaultView?.addEventListener("blur", letGoOfAll);
  return () => {
    letGoOfAll();
    parent.ownerDocument.defaultView?.removeEventListener("blur", letGoOfAll);
    cluster.remove();
  };
}
