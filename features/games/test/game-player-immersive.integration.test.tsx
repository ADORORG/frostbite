// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  harness as h,
  mount,
  registerHarness,
} from "./support/player-harness.tsx";

registerHarness();

// A touch screen (the main pointer is a finger) or not, and whether the browser allows full screen. jsdom has neither.
function device(options: { fullscreen: boolean; touch: boolean }) {
  window.matchMedia = vi.fn((query: string) => ({
    addEventListener: () => undefined,
    matches: options.touch && query === "(pointer: coarse)",
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: options.fullscreen,
  });
}
const fullscreenElement = (value: Element | null) =>
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value,
  });

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(document, "fullscreenEnabled");
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(document, "exitFullscreen");
});

const names = (root: ParentNode) =>
  [...root.querySelectorAll("button")].map(
    (b) => b.getAttribute("aria-label") ?? b.textContent,
  );
const bar = () => h.container.querySelector(".arcade-stage__bar");
const exit = () => h.container.querySelector(".arcade-stage__exit");
const stage = () => h.container.querySelector(".arcade-stage");
const play = () =>
  [...(bar()?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent === "Play full screen",
  );

describe("the bar over the game, by the screen it is on", () => {
  it("has the two ways to give the game room on a screen with a mouse", async () => {
    device({ fullscreen: true, touch: false });
    await mount();
    expect(names(bar() as Element)).toEqual(["Theatre", "Full screen"]);
  });

  it("has the one way, that does both, on a touch screen", async () => {
    device({ fullscreen: true, touch: true });
    await mount();
    expect(names(bar() as Element)).toEqual(["Play full screen"]);
  });
});

describe("playing full screen on a touch screen", () => {
  it("gives the page's window and the browser's full screen together", async () => {
    device({ fullscreen: true, touch: true });
    const { frame } = await mount();
    const request = vi.fn(async () => undefined);
    frame.requestFullscreen = request;
    await act(async () => play()?.click());
    expect(request).toHaveBeenCalledTimes(1);
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
  });

  it("gives the window alone where the browser has no full screen, so the one button still works", async () => {
    device({ fullscreen: false, touch: true });
    const { frame } = await mount();
    const request = vi.fn(async () => undefined);
    frame.requestFullscreen = request;
    await act(async () => play()?.click());
    expect(request).not.toHaveBeenCalled();
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
  });

  it("takes the bar away and leaves a way out over the corner", async () => {
    device({ fullscreen: false, touch: true });
    await mount();
    expect(exit()).toBeNull();
    await act(async () => play()?.click());
    expect(bar()).toBeNull();
    expect(names(exit() as Element)).toEqual(["Leave full screen"]);
  });

  it("is left with the way out, which gives the bar back", async () => {
    device({ fullscreen: false, touch: true });
    await mount();
    await act(async () => play()?.click());
    await act(async () =>
      exit()
        ?.querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(stage()?.hasAttribute("data-theatre")).toBe(false);
    expect(exit()).toBeNull();
    expect(bar()).not.toBeNull();
  });

  it("also leaves the browser's full screen when the way out is used", async () => {
    device({ fullscreen: true, touch: true });
    const { frame } = await mount();
    frame.requestFullscreen = async () => undefined;
    const exitFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    await act(async () => play()?.click());
    fullscreenElement(frame);
    await act(async () =>
      exit()
        ?.querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("ends the window too when the browser ends its full screen (the phone's own gesture)", async () => {
    device({ fullscreen: true, touch: true });
    const { frame } = await mount();
    frame.requestFullscreen = async () => undefined;
    await act(async () => play()?.click());
    fullscreenElement(frame);
    await act(async () =>
      document.dispatchEvent(new Event("fullscreenchange")),
    );
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
    fullscreenElement(null);
    await act(async () =>
      document.dispatchEvent(new Event("fullscreenchange")),
    );
    expect(stage()?.hasAttribute("data-theatre")).toBe(false);
    expect(bar()).not.toBeNull();
  });

  it("leaves a window given without full screen alone when some other full screen ends", async () => {
    device({ fullscreen: false, touch: true });
    await mount();
    await act(async () => play()?.click());
    await act(async () =>
      document.dispatchEvent(new Event("fullscreenchange")),
    );
    expect(stage()?.getAttribute("data-theatre")).toBe("true");
  });
});
