// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachTouchButtons,
  maxTouchButtons,
  type TouchButton,
} from "../src/touch-buttons.ts";

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

// jsdom has no pointer capture; the buttons ask for it, so it is a spy.
const captured = vi.fn();
HTMLElement.prototype.setPointerCapture = captured;

function setup(count = 2) {
  const main = document.createElement("main");
  const screen = document.createElement("canvas");
  main.append(screen);
  document.body.append(main);
  const calls: string[] = [];
  const buttons: TouchButton[] = Array.from({ length: count }, (_, which) => ({
    label: `B${String(which)}`,
    press: () => void calls.push(`press ${String(which)}`),
    release: () => void calls.push(`release ${String(which)}`),
  }));
  const stop = attachTouchButtons(main, buttons);
  stops.push(stop);
  const elements = [...main.querySelectorAll("button")];
  return { calls, elements, main, screen, stop };
}
const send = (
  target: EventTarget,
  type: string,
  init: { detail?: number; id?: number } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    detail: init.detail ?? 0,
  });
  Object.assign(event, { pointerId: init.id ?? 1, pointerType: "touch" });
  target.dispatchEvent(event);
  return event;
};

describe("the buttons over the screen", () => {
  it("are a cluster of named buttons in the element that holds the screen", () => {
    const { elements, main } = setup(3);
    expect(main.querySelector(".touch-buttons")).not.toBeNull();
    expect(elements.map((button) => button.textContent)).toEqual([
      "B0",
      "B1",
      "B2",
    ]);
    expect(elements.map((button) => button.getAttribute("aria-label"))).toEqual(
      ["B0", "B1", "B2"],
    );
    expect(elements.every((button) => button.type === "button")).toBe(true);
  });

  it("refuse none, and more than the limit, so nobody rebuilds the pad", () => {
    const main = document.createElement("main");
    const one: TouchButton = { label: "A", press: vi.fn(), release: vi.fn() };
    expect(() => attachTouchButtons(main, [])).toThrow(/1 to 4/u);
    expect(() =>
      attachTouchButtons(
        main,
        Array.from({ length: maxTouchButtons + 1 }, () => one),
      ),
    ).toThrow(/not 5/u);
    stops.push(
      attachTouchButtons(
        main,
        Array.from({ length: maxTouchButtons }, () => one),
      ),
    );
  });
});

describe("a finger on a button", () => {
  it("presses it going down and releases it coming up, once each, and holds the pointer", () => {
    const { calls, elements } = setup();
    const down = send(elements[0]!, "pointerdown");
    expect(calls).toEqual(["press 0"]);
    expect(down.defaultPrevented).toBe(true);
    expect(captured).toHaveBeenCalledWith(1);
    send(elements[0]!, "pointerup");
    expect(calls).toEqual(["press 0", "release 0"]);
  });

  it("is still holding the button after it slides off, until it lifts", () => {
    const { calls, elements } = setup();
    send(elements[0]!, "pointerdown");
    send(document.body, "pointermove");
    expect(calls).toEqual(["press 0"]);
    send(elements[0]!, "pointerup");
    expect(calls).toEqual(["press 0", "release 0"]);
  });

  it("is let go when the touch is cancelled", () => {
    const { calls, elements } = setup();
    send(elements[1]!, "pointerdown");
    send(elements[1]!, "pointercancel");
    expect(calls).toEqual(["press 1", "release 1"]);
  });

  it("does not reach the screen, so it never starts a zone", () => {
    const { elements, screen } = setup();
    const onScreen = vi.fn();
    screen.addEventListener("pointerdown", onScreen);
    send(elements[0]!, "pointerdown");
    expect(onScreen).not.toHaveBeenCalled();
  });
});

describe("two fingers", () => {
  it("on two buttons hold both, and let go of each as its own finger lifts", () => {
    const { calls, elements } = setup();
    send(elements[0]!, "pointerdown", { id: 1 });
    send(elements[1]!, "pointerdown", { id: 2 });
    send(elements[0]!, "pointerup", { id: 1 });
    expect(calls).toEqual(["press 0", "press 1", "release 0"]);
    send(elements[1]!, "pointerup", { id: 2 });
    expect(calls.at(-1)).toBe("release 1");
  });

  it("on one button press it once, and release it when the last finger lifts", () => {
    const { calls, elements } = setup();
    send(elements[0]!, "pointerdown", { id: 1 });
    send(elements[0]!, "pointerdown", { id: 2 });
    send(elements[0]!, "pointerup", { id: 1 });
    expect(calls).toEqual(["press 0"]);
    send(elements[0]!, "pointerup", { id: 2 });
    expect(calls).toEqual(["press 0", "release 0"]);
  });

  it("lifting a finger that was never on a button does nothing", () => {
    const { calls, elements } = setup();
    send(elements[0]!, "pointerup", { id: 9 });
    expect(calls).toEqual([]);
  });
});

describe("the keyboard and losing the page", () => {
  it("a click no pointer began (Enter or Space on a focused button) is a press and a release", () => {
    const { calls, elements } = setup();
    send(elements[1]!, "click", { detail: 0 });
    expect(calls).toEqual(["press 1", "release 1"]);
  });

  it("a click that follows a touch is not a second press", () => {
    const { calls, elements } = setup();
    send(elements[1]!, "click", { detail: 1 });
    expect(calls).toEqual([]);
  });

  it("the page losing focus lets go of every button held", () => {
    const { calls, elements } = setup();
    send(elements[0]!, "pointerdown", { id: 1 });
    send(elements[1]!, "pointerdown", { id: 2 });
    window.dispatchEvent(new Event("blur"));
    expect(calls.slice(2).sort()).toEqual(["release 0", "release 1"]);
    send(elements[0]!, "pointerup", { id: 1 });
    expect(calls).toHaveLength(4);
  });

  it("removing the buttons lets go of what is held and takes the cluster away", () => {
    const { calls, elements, main, stop } = setup();
    send(elements[0]!, "pointerdown");
    stop();
    expect(calls).toEqual(["press 0", "release 0"]);
    expect(main.querySelector(".touch-buttons")).toBeNull();
    window.dispatchEvent(new Event("blur"));
    expect(calls).toHaveLength(2);
  });
});
