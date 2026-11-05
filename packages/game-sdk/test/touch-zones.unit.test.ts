// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { attachZones } from "../src/touch-zones.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

// A screen 400 by 200 at the top left of the page, cut in a left half ("a") and a right half ("b").
function setup(options: { fingersOnly?: boolean; slide?: boolean } = {}) {
  const screen = document.createElement("canvas");
  screen.getBoundingClientRect = () =>
    ({ height: 200, left: 0, top: 0, width: 400 }) as DOMRect;
  document.body.append(screen);
  const enter = vi.fn();
  const leave = vi.fn();
  const seen = vi.fn();
  stops.push(
    attachZones<"a" | "b">(screen, {
      enter,
      fingersOnly: options.fingersOnly ?? true,
      leave,
      slide: options.slide ?? true,
      zoneAt: (where) => {
        seen(where);
        return where.x < 0.5 ? "a" : "b";
      },
    }),
  );
  return { enter, leave, screen, seen };
}
const send = (
  target: EventTarget,
  type: string,
  init: { id?: number; kind?: string; x?: number; y?: number },
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
  });
  Object.assign(event, {
    pointerId: init.id ?? 1,
    pointerType: init.kind ?? "touch",
  });
  target.dispatchEvent(event);
  return event;
};

describe("a finger on the screen", () => {
  it("is told to the game as a part of the width and the height, so any size serves", () => {
    const { screen, seen } = setup();
    send(screen, "pointerdown", { x: 100, y: 50 });
    expect(seen).toHaveBeenLastCalledWith({ x: 0.25, y: 0.25 });
  });

  it("enters the zone it lands in, and leaves it when it lifts, and keeps a touch from scrolling or zooming", () => {
    const { enter, leave, screen } = setup();
    expect(send(screen, "pointerdown", { x: 300 }).defaultPrevented).toBe(true);
    expect(enter.mock.calls).toEqual([["b"]]);
    send(window, "pointerup", { x: 300 });
    expect(leave.mock.calls).toEqual([["b"]]);
    send(window, "pointerup", { x: 300 });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("leaves one zone and enters the next as it slides, and does nothing while it stays in one", () => {
    const { enter, leave, screen } = setup();
    send(screen, "pointerdown", { x: 300 });
    send(window, "pointermove", { x: 350 });
    expect(enter).toHaveBeenCalledTimes(1);
    send(window, "pointermove", { x: 100 });
    expect(leave.mock.calls).toEqual([["b"]]);
    expect(enter.mock.calls).toEqual([["b"], ["a"]]);
  });

  it("holds nothing where there is no zone, and takes the zone up again on coming back into one", () => {
    const screen = document.createElement("canvas");
    screen.getBoundingClientRect = () =>
      ({ height: 200, left: 0, top: 0, width: 400 }) as DOMRect;
    document.body.append(screen);
    const enter = vi.fn();
    const leave = vi.fn();
    stops.push(
      attachZones<"a">(screen, {
        enter,
        fingersOnly: true,
        leave,
        slide: true,
        zoneAt: (where) => (where.x < 0.5 ? "a" : null),
      }),
    );
    send(screen, "pointerdown", { x: 300 });
    expect(enter).not.toHaveBeenCalled();
    send(window, "pointermove", { x: 100 });
    expect(enter.mock.calls).toEqual([["a"]]);
    send(window, "pointermove", { x: 300 });
    expect(leave.mock.calls).toEqual([["a"]]);
    send(window, "pointerup", { x: 300 });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it("holds the zone it landed in when sliding is off", () => {
    const { enter, leave, screen } = setup({ slide: false });
    send(screen, "pointerdown", { x: 300 });
    send(window, "pointermove", { x: 100 });
    expect(enter).toHaveBeenCalledTimes(1);
    expect(leave).not.toHaveBeenCalled();
  });

  it("follows each finger on its own, so two thumbs hold two zones", () => {
    const { enter, leave, screen } = setup();
    send(screen, "pointerdown", { id: 1, x: 100 });
    send(screen, "pointerdown", { id: 2, x: 300 });
    send(window, "pointerup", { id: 1, x: 100 });
    expect(enter.mock.calls).toEqual([["a"], ["b"]]);
    expect(leave.mock.calls).toEqual([["a"]]);
  });

  it("lets go of a finger the browser took away, and of every finger when the page loses focus", () => {
    const { leave, screen } = setup();
    send(screen, "pointerdown", { id: 1, x: 100 });
    send(window, "pointercancel", { id: 1, x: 100 });
    expect(leave.mock.calls).toEqual([["a"]]);
    send(screen, "pointerdown", { id: 2, x: 300 });
    window.dispatchEvent(new Event("blur"));
    expect(leave.mock.calls).toEqual([["a"], ["b"]]);
    send(window, "pointerup", { id: 2, x: 300 });
    expect(leave).toHaveBeenCalledTimes(2);
  });
});

describe("what is not a finger", () => {
  it("is ignored while only fingers count, and is a pointer like any other when they do not", () => {
    const only = setup();
    const event = send(only.screen, "pointerdown", { kind: "mouse", x: 300 });
    expect(only.enter).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    const any = setup({ fingersOnly: false });
    send(any.screen, "pointerdown", { kind: "mouse", x: 300 });
    expect(any.enter).toHaveBeenCalledWith("b");
  });
});

describe("stopping", () => {
  it("lets go of what is held and takes every listener it added away", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { leave, screen, enter } = setup();
    send(screen, "pointerdown", { x: 300 });
    stops.splice(0)[0]?.();
    expect(leave).toHaveBeenLastCalledWith("b");
    const names = (spy: typeof added) => spy.mock.calls.map(([name]) => name);
    expect(names(removed).sort()).toEqual(names(added).sort());
    send(screen, "pointerdown", { x: 300 });
    expect(enter).toHaveBeenCalledTimes(1);
    added.mockRestore();
    removed.mockRestore();
  });
});
