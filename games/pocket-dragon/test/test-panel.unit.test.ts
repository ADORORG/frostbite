// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { element } from "../src/page/elements.ts";
import { startQuestRun } from "../src/page/quest-run.ts";
import { startRun } from "../src/page/runs.ts";
import {
  attachTestMode,
  createTestPanel,
  holdMs,
  holdToOpen,
} from "../src/page/test-panel.ts";
import { createView } from "../src/page/view.ts";
import { surface } from "./support/canvas.ts";

// The admin's key stands in as "RIGHT" here: the real key is never in the tests.
vi.mock("../src/test-mode/key.ts", () => ({
  keyMatches: (key: string) => Promise.resolve(key === "RIGHT"),
}));

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => new Promise((done) => setTimeout(done, 0));
const press = (target: Element, type: string, button = 0) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button }));
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: name,
    }),
  );

describe("the test mode dialog", () => {
  it("asks for the key over the page, refuses a wrong one, and lets the right one in", async () => {
    const unlocked = vi.fn();
    const panel = createTestPanel({
      check: (typed) => Promise.resolve(typed === "RIGHT"),
      unlocked,
    });
    const input = element("test-key", "input");
    panel.open();
    expect(panel.isOpen()).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(input);
    const heard = vi.fn();
    window.addEventListener("keydown", heard);
    input.value = "WRONG";
    key(input, "Enter");
    await settle();
    expect(heard).not.toHaveBeenCalled();
    expect(element("test-message", "p").textContent).toBe(
      "That key does not unlock test mode.",
    );
    expect(unlocked).not.toHaveBeenCalled();
    input.value = "RIGHT";
    element("test-unlock", "button").click();
    await settle();
    expect(unlocked).toHaveBeenCalledOnce();
    expect(panel.isOpen()).toBe(false);
    expect(input.value).toBe("");
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(false);
    panel.open();
    key(input, "Escape");
    expect(panel.isOpen()).toBe(false);
    panel.open();
    element("test-cancel", "button").click();
    expect(panel.isOpen()).toBe(false);
    window.removeEventListener("keydown", heard);
  });

  it("opens only when the title is held down long enough with the main button", () => {
    vi.useFakeTimers();
    const opened = vi.fn();
    const title = element("title", "h1");
    const stop = holdToOpen(title, opened);
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs - 1);
    expect(opened).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opened).toHaveBeenCalledOnce();
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs / 2);
    press(title, "pointerup");
    vi.advanceTimersByTime(holdMs);
    press(title, "pointerdown", 2);
    vi.advanceTimersByTime(holdMs);
    expect(opened).toHaveBeenCalledOnce();
    const menu = new MouseEvent("contextmenu", { cancelable: true });
    title.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    stop();
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs);
    expect(opened).toHaveBeenCalledOnce();
  });
});

describe("test mode on the page", () => {
  it("turns on with the admin's key from the held title (when allowed), and off from the badge", async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    let allowed = false;
    const mode = attachTestMode({ canOpen: () => allowed, changed });
    const title = element("title", "h1");
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs);
    expect(mode.isOpen()).toBe(false);
    allowed = true;
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs);
    expect(mode.isOpen()).toBe(true);
    element("test-key", "input").value = "RIGHT";
    element("test-unlock", "button").click();
    await vi.runAllTimersAsync();
    expect(mode.on()).toBe(true);
    expect(changed).toHaveBeenLastCalledWith(true);
    press(title, "pointerdown");
    vi.advanceTimersByTime(holdMs);
    expect(mode.isOpen()).toBe(false);
    element("test-leave", "button").click();
    expect(mode.on()).toBe(false);
    expect(changed).toHaveBeenLastCalledWith(false);
  });

  it("shows its badge and its mark on the screen, and none of the counts that would count", () => {
    const screen = surface();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      screen.context,
    );
    const view = createView();
    view.testing(true);
    expect(element("test-badge", "div").hidden).toBe(false);
    expect(element("start", "button").textContent).toBe("Start test run");
    expect(element("share", "button").disabled).toBe(true);
    view.running(false);
    expect(element("share", "button").disabled).toBe(true);
    view.draw(startRun("hills", 4, undefined, true), false, 700, 12);
    expect(screen.texts()).toContain("TEST MODE");
    for (const id of ["score", "best", "plasma"])
      expect(element(id, "strong").textContent).toBe("—");
    expect(element("banked", "strong").textContent).toBe("12");
    view.draw(startQuestRun(4, undefined, true), false, 700, 12);
    expect(element("stat-0-label", "span").textContent).toBe("Time");
    expect(element("stat-0", "strong").textContent).toBe("—");
    view.testing(false);
    view.running(false);
    expect(element("test-badge", "div").hidden).toBe(true);
    expect(element("start", "button").textContent).toBe("Start run");
    expect(element("share", "button").disabled).toBe(false);
  });
});
