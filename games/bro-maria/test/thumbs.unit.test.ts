// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachThumbs,
  backEdge,
  jumpEdge,
  zoneOf,
} from "../src/screen/thumbs.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

// A screen 400 wide at the left of the page: x under 200 is its left half.
function setup() {
  const screen = document.createElement("canvas");
  screen.getBoundingClientRect = () =>
    ({ left: 0, width: 400 }) as unknown as DOMRect;
  document.body.append(screen);
  const hold = vi.fn();
  stops.push(attachThumbs(screen, hold));
  return { hold, screen };
}
const send = (
  target: EventTarget,
  type: string,
  init: { id?: number; kind?: string; x?: number },
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 0,
  });
  Object.assign(event, {
    pointerId: init.id ?? 1,
    pointerType: init.kind ?? "touch",
  });
  target.dispatchEvent(event);
  return event;
};

describe("the zones", () => {
  it("are the left quarter, the next quarter and the right half, and change exactly at the edges", () => {
    expect(zoneOf(0)).toBe("left");
    expect(zoneOf(backEdge - 0.001)).toBe("left");
    expect(zoneOf(backEdge)).toBe("right");
    expect(zoneOf(jumpEdge - 0.001)).toBe("right");
    expect(zoneOf(jumpEdge)).toBe("jump");
    expect(zoneOf(1)).toBe("jump");
  });

  it("are where the guide says they are: a quarter, a quarter and a half of the width", () => {
    expect([0.24, 0.26, 0.49, 0.51].map(zoneOf)).toEqual([
      "left",
      "right",
      "right",
      "jump",
    ]);
  });
});

describe("a finger on the screen", () => {
  it("holds the zone it lands in, with no move needed, and lets go when it lifts", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 50 });
    expect(hold).toHaveBeenLastCalledWith("left", true);
    send(window, "pointerup", { x: 50 });
    expect(hold).toHaveBeenLastCalledWith("left", false);
    send(screen, "pointerdown", { x: 150 });
    expect(hold).toHaveBeenLastCalledWith("right", true);
    send(window, "pointerup", { x: 150 });
    send(screen, "pointerdown", { x: 300 });
    expect(hold).toHaveBeenLastCalledWith("jump", true);
    send(window, "pointerup", { x: 300 });
    expect(hold).toHaveBeenLastCalledWith("jump", false);
  });

  it("slides from one zone to the next: lets go of the first and takes the second", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 150 });
    send(window, "pointermove", { x: 50 });
    expect(hold.mock.calls).toEqual([
      ["right", true],
      ["right", false],
      ["left", true],
    ]);
    send(window, "pointermove", { x: 60 });
    expect(hold).toHaveBeenCalledTimes(3);
    send(window, "pointermove", { x: 350 });
    expect(hold).toHaveBeenLastCalledWith("jump", true);
  });

  it("is a second finger: one thumb runs while the other jumps, each let go on its own", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { id: 1, x: 150 });
    send(screen, "pointerdown", { id: 2, x: 300 });
    expect(hold.mock.calls).toEqual([
      ["right", true],
      ["jump", true],
    ]);
    send(window, "pointerup", { id: 2, x: 300 });
    expect(hold).toHaveBeenLastCalledWith("jump", false);
    send(window, "pointerup", { id: 1, x: 150 });
    expect(hold).toHaveBeenLastCalledWith("right", false);
  });
});

describe("what is not a finger on the screen", () => {
  it("ignores a mouse, which has the keys and the buttons", () => {
    const { hold, screen } = setup();
    const event = send(screen, "pointerdown", { kind: "mouse", x: 300 });
    send(window, "pointerup", { kind: "mouse", x: 300 });
    expect(hold).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets go when told to stop, and listens no more", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 300 });
    stops.splice(0)[0]?.();
    expect(hold).toHaveBeenLastCalledWith("jump", false);
    send(screen, "pointerdown", { x: 300 });
    expect(hold).toHaveBeenCalledTimes(2);
  });
});
