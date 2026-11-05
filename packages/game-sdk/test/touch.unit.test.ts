// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { byInput, isTouchScreen } from "../src/touch.ts";

const screen = (coarse: boolean | null) => {
  if (coarse === null) {
    Reflect.deleteProperty(window, "matchMedia");
    return;
  }
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === "(pointer: coarse)",
  })) as unknown as typeof window.matchMedia;
};
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("how a page is played", () => {
  it("is by finger when the main pointer is coarse, and by keyboard when it is not", () => {
    screen(true);
    expect(isTouchScreen()).toBe(true);
    screen(false);
    expect(isTouchScreen()).toBe(false);
  });

  it("is by keyboard where the browser cannot say", () => {
    screen(null);
    expect(isTouchScreen()).toBe(false);
  });

  it("is by keyboard where there is no window at all", () => {
    vi.stubGlobal("window", undefined);
    expect(isTouchScreen()).toBe(false);
    expect(byInput("PRESS ENTER", "TAP")).toBe("PRESS ENTER");
  });

  it("gives the line for how it is played", () => {
    screen(true);
    expect(byInput("PRESS ENTER", "TAP")).toBe("TAP");
    screen(false);
    expect(byInput("PRESS ENTER", "TAP")).toBe("PRESS ENTER");
  });
});
