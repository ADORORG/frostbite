// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { attachTapToStart, restartDelayMs } from "../src/touch-start.ts";

let clock = 0;
const setup = (options: { touch?: boolean; offered?: boolean } = {}) => {
  const screen = document.createElement("canvas");
  const start = document.createElement("button");
  start.disabled = options.offered === false;
  const starts = vi.fn();
  start.addEventListener("click", starts);
  document.body.append(screen, start);
  const stop = attachTapToStart(screen, start, {
    now: () => clock,
    touch: () => options.touch ?? true,
  });
  return { screen, start, starts, stop };
};
const tap = (screen: HTMLElement) => {
  screen.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  screen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
// The attributes are watched by a mutation observer, which reports after the current task.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.replaceChildren();
  clock = 0;
});

describe("a tap on the screen starts a run", () => {
  it("presses the start button when it has been on offer a while", async () => {
    const { screen, starts } = setup();
    clock = restartDelayMs;
    tap(screen);
    expect(starts).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a screen with a mouse, which clicks the button", () => {
    const { screen, starts } = setup({ touch: false });
    clock = restartDelayMs;
    tap(screen);
    expect(starts).not.toHaveBeenCalled();
  });

  it("does nothing while the button is not on offer (a run is going, or the game is not ready)", async () => {
    const { screen, start, starts } = setup({ offered: false });
    clock = 10_000;
    tap(screen);
    start.hidden = true;
    start.disabled = false;
    await settle();
    tap(screen);
    expect(starts).not.toHaveBeenCalled();
  });

  it("waits for the button to have been on offer a moment, so the tap that ends a run does not start the next", async () => {
    const { screen, start, starts } = setup();
    clock = 5_000;
    start.hidden = true;
    await settle();
    clock = 6_000;
    start.hidden = false;
    await settle();
    clock = 6_000 + restartDelayMs - 1;
    tap(screen);
    expect(starts).not.toHaveBeenCalled();
    clock = 6_000 + restartDelayMs;
    tap(screen);
    expect(starts).toHaveBeenCalledTimes(1);
  });

  it("does not start from the tap that ended the run, though the button is on offer by the time it lifts", async () => {
    const { screen, start, starts } = setup({ offered: false });
    clock = 5_000;
    screen.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    start.disabled = false;
    await settle();
    clock = 9_000;
    screen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).not.toHaveBeenCalled();
  });

  it("starts once for a tap, not again for a click that no finger went down for", () => {
    const { screen, starts } = setup();
    clock = restartDelayMs;
    tap(screen);
    screen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(starts).toHaveBeenCalledTimes(1);
  });

  it("stops listening when told to, even for a finger already down", () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { screen, starts, stop } = setup();
    clock = restartDelayMs;
    screen.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    stop();
    screen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    tap(screen);
    expect(starts).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    disconnect.mockRestore();
  });
});
