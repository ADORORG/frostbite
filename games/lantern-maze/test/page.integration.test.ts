import { defaultSound } from "@ador/game-sdk/audio/settings";
import { pauseCopy } from "@ador/game-sdk/pause";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// Lantern Maze's page, bundled and run against a simulated platform: the connection, the keys, the pad, the pause and the end of a run.
async function opened(saved: Parameters<typeof play>[0] = { best: 0 }) {
  const { stored, window } = await play(saved);
  await settle();
  const el = (id: string) => window.document.getElementById(id);
  const press = (code: string) =>
    window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
  const earned = () =>
    [...window.document.querySelectorAll("#earned li")].map(
      (item) => item.textContent,
    );
  // Any one of the four arrows is a legal step from the start of a maze that has a way out; a wall is refused and changes nothing.
  const wander = () => {
    for (const code of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"])
      press(code);
  };
  return { earned, el, press, stored, wander, window };
}

describe("Lantern Maze's page", () => {
  it("connects, and lets the player start only once it has; the pad waits for a run", async () => {
    const { el, window } = await opened();
    expect(el("status")?.textContent).toBe("Connected.");
    expect(el("start")?.hasAttribute("disabled")).toBe(false);
    expect(el("total")?.textContent).toBe("40");
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
    expect(el("pause")?.hasAttribute("disabled")).toBe(true);
  });

  it("does not start while the platform has not answered", async () => {
    const { window } = await play(undefined, {
      loadProgress: () => new Promise(() => undefined),
    });
    await settle();
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(100);
    expect(
      window.document.getElementById("start")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("starts on Enter, says how to play, and does not throw a run away on Enter again", async () => {
    const { earned, el, press, wander } = await opened();
    press("Enter");
    await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(true);
    expect(el("pause")?.hasAttribute("disabled")).toBe(false);
    expect(el("note")?.textContent).toContain("Find the key");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    wander();
    expect(earned()).toEqual(["first-step"]);
    expect(el("count")?.textContent).toBe("1");
    press("Enter");
    await settle(50);
    expect(earned()).toEqual(["first-step"]);
  });

  it("steps on the arrows, WASD and the pad, and not before a run", async () => {
    const { earned, el, press, wander, window } = await opened();
    wander();
    expect(earned()).toEqual([]);
    press("Enter");
    await settle(100);
    for (const code of ["KeyD", "KeyS", "KeyA", "KeyW"]) press(code);
    expect(earned()).toEqual(["first-step"]);
    expect(el("pad")?.querySelector("button")?.hasAttribute("disabled")).toBe(
      false,
    );
    for (const button of window.document.querySelectorAll("#pad button"))
      button.dispatchEvent(new window.MouseEvent("click"));
  });

  it("pauses on P, on Space and on the button, takes no step while paused, and goes on after", async () => {
    const { earned, el, press, wander, window } = await opened();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(el("pause")?.textContent).toBe("Resume");
    expect(el("note")?.textContent).toBe(pauseCopy.paused);
    wander();
    expect(earned()).toEqual([]);
    press("Space");
    expect(el("pause")?.textContent).toBe("Pause");
    wander();
    expect(earned()).toEqual(["first-step"]);
    el("pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(el("pause")?.textContent).toBe("Resume");
  });

  it("ends a run when the oil is gone, saves the best, and says nothing about the platform", async () => {
    const { el, press, stored, window } = await opened();
    press("Enter");
    await settle(100);
    const codes = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    for (
      let at = 0;
      at < 20_000 && el("start")?.hasAttribute("hidden");
      at += 1
    )
      window.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          code: codes[(at * 7 + (at >> 3)) % 4],
        }),
      );
    await settle(100);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    expect(el("start")?.textContent).toBe("Light another");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
    expect(el("pause")?.hasAttribute("disabled")).toBe(true);
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
  }, 30_000);

  it("pauses itself when the tab is hidden during a run", async () => {
    const { el, press, window } = await opened();
    press("Enter");
    await settle(100);
    Object.defineProperty(window.document, "hidden", {
      configurable: true,
      value: true,
    });
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    expect(el("pause")?.textContent).toBe("Resume");
  });

  it("offers the sound panel in its place", async () => {
    const { el } = await opened();
    expect(el("sound")?.children.length).toBeGreaterThan(0);
  });
});
