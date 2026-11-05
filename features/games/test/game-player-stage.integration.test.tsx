// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toastMs } from "../src/ui/use-game-session.ts";
import {
  flush,
  harness as h,
  mount,
  registerHarness,
  send,
} from "./support/player-harness.tsx";

registerHarness();

const toast = () =>
  h.container.querySelector('[data-testid="milestone-toast"]');
const prompt = () =>
  h.container.querySelector('[data-testid="fullscreen-prompt"]');

// A phone held sideways, as the browser would say it: the media query matches.
function phone(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    addEventListener: () => undefined,
    // The question about a phone held sideways must be asked whole: held sideways, short, and touched. The question about a touch screen
    // alone is only about the touch.
    matches:
      matches &&
      (query.includes("orientation")
        ? ["orientation: landscape", "max-height", "pointer: coarse"].every(
            (part) => query.includes(part),
          )
        : query.includes("pointer: coarse")),
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
  // jsdom has no full screen; a frame says it can, as a browser's would.
  HTMLIFrameElement.prototype.requestFullscreen = async () => undefined;
}
afterEach(() => {
  Reflect.deleteProperty(HTMLIFrameElement.prototype, "requestFullscreen");
  Reflect.deleteProperty(window, "matchMedia");
  Reflect.deleteProperty(document, "fullscreenEnabled");
  vi.useRealTimers();
});

describe("the notice when a milestone is reported", () => {
  it("names the milestone the game has just reported, and clears itself", async () => {
    const { target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    expect(toast()?.textContent).toBe("");
    vi.useFakeTimers();
    send(target, "milestones.unlock", { id: "first-level" }, "b");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(toast()?.textContent).toBe("First level reached");
    expect(toast()?.getAttribute("aria-live")).toBe("polite");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(toastMs);
    });
    expect(toast()?.textContent).toBe("");
  });

  it("announces only the milestone just reported, not the ones announced before", async () => {
    const { target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    send(target, "milestones.unlock", { id: "first-level" }, "b");
    await flush();
    expect(toast()?.textContent).toBe("First level reached");
    send(target, "milestones.unlock", { id: "century" }, "c");
    await flush();
    expect(toast()?.textContent).toBe("Century reached");
  });

  it("does not announce a milestone the player already had", async () => {
    window.localStorage.setItem(
      "ador:game:embedded-game:milestones",
      JSON.stringify({
        "first-level": {
          unlockedAt: "2026-10-01T00:00:00.000Z",
          verification: "self-reported",
        },
      }),
    );
    await mount();
    await flush();
    expect(toast()?.textContent).toBe("");
    expect(h.container.textContent).toContain("1 of 2 reached");
  });

  it("does not announce the same milestone again when the game repeats the call", async () => {
    const { target } = await mount();
    send(target, "ready", { sdkVersion: 1 }, "a");
    await flush();
    vi.useFakeTimers();
    send(target, "milestones.unlock", { id: "first-level" }, "b");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(toastMs + 50);
    });
    expect(toast()?.textContent).toBe("");
    send(target, "milestones.unlock", { id: "first-level" }, "c");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(toast()?.textContent).toBe("");
  });
});

describe("the offer of full screen to a phone held sideways", () => {
  it("is made on a phone in landscape, and not on anything else", async () => {
    phone(false);
    await mount();
    expect(prompt()).toBeNull();
    act(() => h.root.unmount());
    phone(true);
    h.root = (await import("react-dom/client")).createRoot(h.container);
    await mount();
    expect(prompt()?.textContent).toContain("Playing on a phone?");
  });

  it("goes away when the player says not now, and asks for full screen when they say yes", async () => {
    phone(true);
    const { frame } = await mount();
    const call = vi.fn(async () => undefined);
    frame.requestFullscreen = call;
    const buttons = () => [...(prompt()?.querySelectorAll("button") ?? [])];
    await act(async () =>
      buttons()
        .find((b) => b.textContent === "Not now")
        ?.click(),
    );
    expect(prompt()).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("asks for full screen and goes away when the player accepts", async () => {
    phone(true);
    const { frame } = await mount();
    const call = vi.fn(async () => undefined);
    frame.requestFullscreen = call;
    await act(async () =>
      [...(prompt()?.querySelectorAll("button") ?? [])]
        .find((b) => b.textContent === "Play full screen")
        ?.click(),
    );
    expect(call).toHaveBeenCalledTimes(1);
    expect(prompt()).toBeNull();
  });

  it("still makes the one offer where the browser does not allow full screen, since the page can give the game the window itself", async () => {
    phone(true);
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: false,
    });
    await mount();
    const labels = [...(prompt()?.querySelectorAll("button") ?? [])].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Play full screen", "Not now"]);
  });

  it("goes away when the player gives the game the window from the bar instead", async () => {
    phone(true);
    await mount();
    expect(prompt()).not.toBeNull();
    await act(async () =>
      [...h.container.querySelectorAll(".arcade-stage__bar button")]
        .find((b) => b.textContent === "Play full screen")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(
      h.container.querySelector(".arcade-stage")?.getAttribute("data-theatre"),
    ).toBe("true");
    expect(prompt()).toBeNull();
  });

  it("gives the game the whole window, and goes away, when the player accepts", async () => {
    phone(true);
    await mount();
    await act(async () =>
      [...(prompt()?.querySelectorAll("button") ?? [])]
        .find((b) => b.textContent === "Play full screen")
        ?.click(),
    );
    expect(
      h.container.querySelector(".arcade-stage")?.getAttribute("data-theatre"),
    ).toBe("true");
    expect(prompt()).toBeNull();
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    // Leaving theatre does not bring the offer back: the player has answered it.
    expect(prompt()).toBeNull();
  });
});
