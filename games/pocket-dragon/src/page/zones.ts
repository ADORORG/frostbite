// Thumbs on the screen. The surface is cut into zones; a finger that comes down in one, or slides into one, holds what that zone means
// until it slides out or comes up. Each finger is followed on its own, so a left thumb can run while a right one jumps. A mouse is left
// to the keys and buttons, and a press on a button laid over the surface is the button's. A stand-in for the SDK's `attachZones`
// (`@ador/game-sdk/touch-zones`) in the owners' newer `dev`: switch to it once it is on `dev`.
export interface ZoneOptions<Zone extends string> {
  // The zone at a point of the surface (measured from its top left corner) when it is `width` by `height`, or null for none.
  readonly at: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Zone | null;
  readonly enter: (zone: Zone) => void;
  readonly leave: (zone: Zone) => void;
}

// A finger or a pen on the surface itself, not a mouse and not a button over it.
export const plays = (event: PointerEvent): boolean =>
  event.pointerType !== "mouse" &&
  !(event.target instanceof Element && event.target.closest("button") !== null);

export function attachZones<Zone extends string>(
  surface: HTMLElement,
  options: ZoneOptions<Zone>,
): () => void {
  const fingers = new Map<number, Zone | null>();
  const zoneOf = (event: PointerEvent): Zone | null => {
    const box = surface.getBoundingClientRect();
    return options.at(
      event.clientX - box.left,
      event.clientY - box.top,
      box.width,
      box.height,
    );
  };
  const move = (finger: number, to: Zone | null): void => {
    const from = fingers.get(finger) ?? null;
    fingers.set(finger, to);
    if (from === to) return;
    if (from !== null) options.leave(from);
    if (to !== null) options.enter(to);
  };
  const lift = (finger: number): void => {
    move(finger, null);
    fingers.delete(finger);
  };
  const down = (event: PointerEvent): void => {
    if (!plays(event)) return;
    event.preventDefault();
    try {
      // Followed even if it strays off the surface, so its zone is let go of when it comes up.
      surface.setPointerCapture(event.pointerId);
    } catch {
      // A page that cannot capture a finger still sees it while it is over the surface.
    }
    move(event.pointerId, zoneOf(event));
  };
  const slide = (event: PointerEvent): void => {
    if (fingers.has(event.pointerId)) move(event.pointerId, zoneOf(event));
  };
  const up = (event: PointerEvent): void => {
    if (fingers.has(event.pointerId)) lift(event.pointerId);
  };
  const letGo = (): void => {
    for (const finger of [...fingers.keys()]) lift(finger);
  };
  const ups = ["pointerup", "pointercancel", "lostpointercapture"] as const;
  surface.addEventListener("pointerdown", down);
  surface.addEventListener("pointermove", slide);
  for (const type of ups) surface.addEventListener(type, up);
  window.addEventListener("blur", letGo);
  return () => {
    letGo();
    surface.removeEventListener("pointerdown", down);
    surface.removeEventListener("pointermove", slide);
    for (const type of ups) surface.removeEventListener(type, up);
    window.removeEventListener("blur", letGo);
  };
}
