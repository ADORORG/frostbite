import type { Controls } from "../rules/types.ts";

// The touch screen is the controller, with no buttons over it. A finger on the left half is a thumb stick: it runs the way the finger goes
// from where it landed. A finger on the right half is the jump, held while it is down. Fingers are followed one by one, so a thumb can run
// while the other one jumps.
export type Hold = (control: keyof Controls, on: boolean) => void;

// How far a finger must go from where it landed before it is running, and how far from the finger the place it landed may trail: past
// that the place follows the finger, so a thumb that has gone a long way right can turn left with a short move and not a long one.
export const stickDeadZone = 14;
export const stickReach = 44;

export function stickDirection(offset: number): "left" | "right" | null {
  if (offset <= -stickDeadZone) return "left";
  if (offset >= stickDeadZone) return "right";
  return null;
}

interface Finger {
  anchor: number;
  held: keyof Controls | null;
}

// Listens on the screen for fingers (not mice or pens, which have the keys and the buttons). Returns a function that stops listening and lets
// go of whatever is held.
export function attachThumbs(screen: HTMLElement, hold: Hold): () => void {
  const fingers = new Map<number, Finger>();
  const set = (finger: Finger, next: keyof Controls | null): void => {
    if (finger.held === next) return;
    if (finger.held !== null) hold(finger.held, false);
    finger.held = next;
    if (next !== null) hold(next, true);
  };
  const onDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    const box = screen.getBoundingClientRect();
    const finger: Finger = { anchor: event.clientX, held: null };
    fingers.set(event.pointerId, finger);
    if (event.clientX >= box.left + box.width / 2) set(finger, "jump");
    event.preventDefault();
  };
  const onMove = (event: PointerEvent): void => {
    const finger = fingers.get(event.pointerId);
    if (finger === undefined || finger.held === "jump") return;
    finger.anchor = Math.min(
      Math.max(finger.anchor, event.clientX - stickReach),
      event.clientX + stickReach,
    );
    set(finger, stickDirection(event.clientX - finger.anchor));
  };
  const onUp = (event: PointerEvent): void => {
    const finger = fingers.get(event.pointerId);
    if (finger === undefined) return;
    set(finger, null);
    fingers.delete(event.pointerId);
  };
  const letGo = (): void => {
    for (const finger of fingers.values()) set(finger, null);
    fingers.clear();
  };
  screen.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("blur", letGo);
  return () => {
    letGo();
    screen.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    window.removeEventListener("blur", letGo);
  };
}
