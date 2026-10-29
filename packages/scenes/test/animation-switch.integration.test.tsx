// @vitest-environment jsdom

import {
  click,
  installReactTestEnvironment,
  mount,
  textOf,
} from "@ador/test-kit/dom";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { preferenceKey } from "../src/engine/index.ts";
import { AnimationToggle, ScenesProvider } from "../src/react/index.ts";
import { sceneCopy } from "../src/react/copy.ts";
import { blocks } from "../src/scenes/blocks.ts";
import { runner } from "../src/scenes/runner.ts";
import { installBrowser } from "./support/browser.ts";
import { stage, toggle } from "./support/stage.tsx";

installReactTestEnvironment();
const browser = installBrowser();

describe("the animation switch", () => {
  it("says animations are on when nothing asks for less, and presses itself", async () => {
    const container = await mount(stage(null));
    expect(textOf(container)).toBe(sceneCopy.switchOn);
    expect(toggle(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(toggle(container)?.getAttribute("aria-label")).toBe(
      sceneCopy.switchLabel,
    );
  });

  it("turns animation off when pressed, remembers it, and a later visit starts off", async () => {
    const container = await mount(stage(null));
    click(toggle(container));
    await act(async () => undefined);
    expect(textOf(container)).toBe(sceneCopy.switchOff);
    expect(toggle(container)?.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(preferenceKey)).toBe("off");
    const later = await mount(stage(null));
    expect(textOf(later)).toBe(sceneCopy.switchOff);
  });

  it("starts off for a device that asks for reduced motion, and lets the person turn it on", async () => {
    browser.reducedMotion(true);
    const container = await mount(stage(null));
    expect(textOf(container)).toBe(sceneCopy.switchOff);
    click(toggle(container));
    await act(async () => undefined);
    expect(textOf(container)).toBe(sceneCopy.switchOn);
    expect(localStorage.getItem(preferenceKey)).toBe("on");
  });

  it("stops when the device starts asking for reduced motion while the page is open", async () => {
    const container = await mount(stage(null));
    expect(textOf(container)).toBe(sceneCopy.switchOn);
    await act(async () => browser.reducedMotion(true));
    expect(textOf(container)).toBe(sceneCopy.switchOff);
  });

  it("starts off for a data saver and for a weak device", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    expect(textOf(await mount(stage(null)))).toBe(sceneCopy.switchOff);
    Reflect.deleteProperty(navigator, "connection");
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: 1,
    });
    expect(textOf(await mount(stage(null)))).toBe(sceneCopy.switchOff);
  });

  it("says animations are off on the server, where nothing is known yet, so the first paint is honest", () => {
    const html = renderToString(
      <ScenesProvider list={[blocks, runner]}>
        <AnimationToggle />
      </ScenesProvider>,
    );
    expect(html).toContain(sceneCopy.switchOff);
    expect(html).toContain('aria-pressed="false"');
  });

  it("runs one frame loop while the page is open, and none once it is gone", async () => {
    const { unmountAll } = await import("@ador/test-kit/dom");
    await mount(stage(null));
    expect(browser.looping()).toBe(true);
    await unmountAll();
    expect(browser.looping()).toBe(false);
  });

  it("is refused outside a provider rather than doing nothing", async () => {
    const quiet = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await expect(mount(<AnimationToggle />)).rejects.toThrow("ScenesProvider");
    quiet.mockRestore();
  });
});
