// The screen as the controller: it is cut into zones, and a finger holds the zone it is in. Where a finger goes is read as a part of the
// screen's width and height (0 to 1 from its top left corner), so the same cut serves whatever size the screen is shown at. A game says
// where the zones are (`zoneAt`) and what entering and leaving one means; fingers are followed one by one, so two thumbs hold two zones.
export interface Where {
  readonly x: number;
  readonly y: number;
}

export interface ZoneOptions<Zone> {
  // Only a finger counts (a mouse has the keys and the buttons). Off, a mouse or a pen holds a zone too.
  readonly fingersOnly: boolean;
  readonly enter: (zone: Zone) => void;
  readonly leave: (zone: Zone) => void;
  // A finger that slides from one zone to the next leaves the first and enters the second. Off, it holds the zone it landed in.
  readonly slide: boolean;
  // The zone at a point, or null where there is none (a finger there holds nothing).
  readonly zoneAt: (where: Where) => Zone | null;
}

interface Finger<Zone> {
  held: Zone | null;
}

// Listens on the screen for pointers. Returns a function that stops listening and
// lets go of every zone held.
export function attachZones<Zone>(
  screen: HTMLElement,
  { enter, fingersOnly, leave, slide, zoneAt }: ZoneOptions<Zone>,
): () => void {
  const fingers = new Map<number, Finger<Zone>>();
  const set = (finger: Finger<Zone>, next: Zone | null): void => {
    if (finger.held === next) return;
    if (finger.held !== null) leave(finger.held);
    finger.held = next;
    if (next !== null) enter(next);
  };
  const under = (event: PointerEvent): Zone | null => {
    const box = screen.getBoundingClientRect();
    return zoneAt({
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    });
  };
  const onDown = (event: PointerEvent): void => {
    if (fingersOnly && event.pointerType !== "touch") return;
    const finger: Finger<Zone> = { held: null };
    fingers.set(event.pointerId, finger);
    set(finger, under(event));
    event.preventDefault();
  };
  const onMove = (event: PointerEvent): void => {
    const finger = fingers.get(event.pointerId);
    if (slide && finger !== undefined) set(finger, under(event));
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
