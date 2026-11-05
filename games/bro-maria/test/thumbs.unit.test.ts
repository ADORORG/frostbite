// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachThumbs,
  stickDeadZone,
  stickDirection,
  stickReach,
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

describe("the thumb stick", () => {
  it("has a dead zone, and a way for each side of it", () => {
    expect(stickDirection(0)).toBeNull();
    expect(stickDirection(stickDeadZone - 1)).toBeNull();
    expect(stickDirection(-(stickDeadZone - 1))).toBeNull();
    expect(stickDirection(stickDeadZone)).toBe("right");
    expect(stickDirection(-stickDeadZone)).toBe("left");
  });
});

describe("a finger on the left half", () => {
  it("runs the way it goes from where it landed, and stops when it comes back or lifts", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 100 });
    expect(hold).not.toHaveBeenCalled();
    send(window, "pointermove", { x: 100 + stickDeadZone });
    expect(hold).toHaveBeenLastCalledWith("right", true);
    send(window, "pointermove", { x: 100 + stickDeadZone + 3 });
    expect(hold).toHaveBeenCalledTimes(1);
    send(window, "pointermove", { x: 100 });
    expect(hold).toHaveBeenLastCalledWith("right", false);
    send(window, "pointermove", { x: 100 - stickDeadZone });
    expect(hold).toHaveBeenLastCalledWith("left", true);
    send(window, "pointerup", { x: 100 - stickDeadZone });
    expect(hold).toHaveBeenLastCalledWith("left", false);
  });

  it("turns with a short move after a long one, because the place it landed follows the finger", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 50 });
    send(window, "pointermove", { x: 50 + stickReach * 3 });
    expect(hold).toHaveBeenLastCalledWith("right", true);
    send(window, "pointermove", {
      x: 50 + stickReach * 3 - stickReach - stickDeadZone,
    });
    expect(hold).toHaveBeenLastCalledWith("left", true);
  });

  it("does not jump", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 199 });
    send(window, "pointermove", { x: 150 });
    expect(hold).not.toHaveBeenCalledWith("jump", true);
  });
});

describe("a finger on the right half", () => {
  it("jumps while it is down, wherever it goes", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 200 });
    expect(hold).toHaveBeenLastCalledWith("jump", true);
    send(window, "pointermove", { x: 390 });
    send(window, "pointermove", { x: 10 });
    expect(hold).toHaveBeenCalledTimes(1);
    send(window, "pointerup", { x: 10 });
    expect(hold).toHaveBeenLastCalledWith("jump", false);
  });

  it("is a second finger: one thumb runs while the other jumps, each let go on its own", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { id: 1, x: 100 });
    send(window, "pointermove", { id: 1, x: 200 - 1 });
    send(screen, "pointerdown", { id: 2, x: 300 });
    expect(hold.mock.calls).toEqual([
      ["right", true],
      ["jump", true],
    ]);
    send(window, "pointerup", { id: 2, x: 300 });
    expect(hold).toHaveBeenLastCalledWith("jump", false);
    send(window, "pointerup", { id: 1, x: 199 });
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

  it("ignores a finger that has lifted", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { x: 100 });
    send(window, "pointerup", { x: 100 });
    send(window, "pointermove", { x: 100 + stickReach });
    expect(hold).not.toHaveBeenCalled();
  });

  it("takes every listener it put on the page away when told to stop", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    setup();
    stops.splice(0)[0]?.();
    const names = (spy: typeof added) => spy.mock.calls.map(([name]) => name);
    expect(names(removed).sort()).toEqual(names(added).sort());
    added.mockRestore();
    removed.mockRestore();
  });

  it("keeps a touch from scrolling or zooming the page", () => {
    const { screen } = setup();
    expect(send(screen, "pointerdown", { x: 300 }).defaultPrevented).toBe(true);
  });

  it("lets go of everything when the page loses focus, since the lift would never be seen", () => {
    const { hold, screen } = setup();
    send(screen, "pointerdown", { id: 1, x: 300 });
    window.dispatchEvent(new Event("blur"));
    expect(hold).toHaveBeenLastCalledWith("jump", false);
    send(window, "pointerup", { id: 1, x: 300 });
    expect(hold).toHaveBeenCalledTimes(2);
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
