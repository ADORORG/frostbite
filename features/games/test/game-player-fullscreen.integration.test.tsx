// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import {
  flush,
  harness as h,
  mount,
  registerHarness,
} from "./support/player-harness.tsx";

registerHarness();

// jsdom has no full screen. These stand in for the browser's: it says whether it is allowed and enters on request.
function browser(options: { enabled: boolean }) {
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: options.enabled,
  });
}
const request = (frame: HTMLIFrameElement, refuse = false) => {
  const call = vi.fn(async () => {
    if (refuse) throw new Error("denied");
  });
  frame.requestFullscreen = call;
  return call;
};
const button = () =>
  [...h.container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === "Full screen",
  );

afterEach(() => {
  Reflect.deleteProperty(document, "fullscreenEnabled");
});

describe("the full screen button on the game panel", () => {
  it("is not offered where the browser does not allow full screen", async () => {
    browser({ enabled: false });
    await mount();
    expect(button()).toBeUndefined();
  });

  it("asks the browser to show the game's frame full screen", async () => {
    browser({ enabled: true });
    const { frame } = await mount();
    const call = request(frame);
    await act(async () => button()?.click());
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("tells the player how to leave, since the frame then covers the page", async () => {
    browser({ enabled: true });
    await mount();
    expect(h.container.textContent).toContain(
      "Press Esc to leave full screen.",
    );
  });

  it("says so when the browser refuses, and clears the message on the next try", async () => {
    browser({ enabled: true });
    const { frame } = await mount();
    request(frame, true);
    await act(async () => button()?.click());
    await flush();
    expect(h.container.textContent).toContain("did not allow full screen");
    request(frame, false);
    await act(async () => button()?.click());
    await flush();
    expect(h.container.textContent).not.toContain("did not allow full screen");
  });
});
