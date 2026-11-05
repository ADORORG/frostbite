// @vitest-environment jsdom

import { installReactTestEnvironment, mount } from "@frostbite/test-kit/dom";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { SceneBackdrop } from "../src/react/index.ts";
import { installBrowser } from "./support/browser.ts";
import { canvases, frameAt as frameAtOf, stage } from "./support/stage.tsx";

installReactTestEnvironment();
const browser = installBrowser();
const frameAt = frameAtOf(browser);

describe("visibility", () => {
  it("draws only once the canvas is on screen, and a still when it leaves", async () => {
    const observers = browser.observe();
    const container = await mount(stage(<SceneBackdrop sceneId="runner" />));
    const [canvas] = canvases(container);
    await frameAt(1000);
    expect(browser.frames(canvas ?? null)).toBe(0);
    await act(async () => observers[0]?.emit(true));
    await frameAt(1100);
    expect(browser.frames(canvas ?? null)).toBeGreaterThan(0);
    const before = browser.frames(canvas ?? null);
    await act(async () => observers[0]?.emit(false));
    await frameAt(1200);
    await frameAt(1300);
    expect(browser.frames(canvas ?? null)).toBe(before);
  });

  it("lets go of its observer and stops drawing when it is removed", async () => {
    const observers = browser.observe();
    const container = await mount(stage(<SceneBackdrop sceneId="runner" />));
    const [canvas] = canvases(container);
    await act(async () => observers[0]?.emit(true));
    await frameAt(1000);
    const before = browser.frames(canvas ?? null);
    await act(async () => {
      // Unmounting the whole tree is what removes it.
    });
    const { unmountAll } = await import("@frostbite/test-kit/dom");
    await unmountAll();
    expect(observers[0]?.disconnected).toBe(true);
    await frameAt(1200);
    expect(browser.frames(canvas ?? null)).toBe(before);
  });
});
