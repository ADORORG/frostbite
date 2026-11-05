import { defaultSound } from "@ador/game-sdk/audio/settings";
import { pauseCopy } from "@ador/game-sdk/pause";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// Shard Match's page, bundled and run against a simulated platform: the connection, the keys, the pause and the end of a run. The board is
// from a seed of the page's own, so these play it with every key: a swap that makes no line is refused and changes nothing.
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
  // Goes over the whole board with the cursor, and at each cell picks the shard up and tries each way (a swap that makes no line is refused).
  const wander = (rounds = 1) => {
    for (let round = 0; round < rounds; round += 1) {
      for (let at = 0; at < 8; at += 1) {
        press("ArrowUp");
        press("ArrowLeft");
      }
      for (let row = 0; row < 8; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          for (const way of ["ArrowRight", "ArrowDown"]) {
            press("Space");
            press(way);
          }
          press("ArrowRight");
        }
        for (let at = 0; at < 8; at += 1) press("ArrowLeft");
        press("ArrowDown");
      }
    }
  };
  const ended = () =>
    el("note")?.textContent?.includes("your own claim") === true;
  return { earned, ended, el, press, stored, wander, window };
}

describe("Shard Match's page", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { el } = await opened();
    expect(el("status")?.textContent).toBe("Connected.");
    expect(el("start")?.hasAttribute("disabled")).toBe(false);
    expect(el("total")?.textContent).toBe("40");
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
    expect(el("note")?.textContent).toContain("Swap");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    wander();
    expect(earned()).toContain("first-swap");
    const count = earned().length;
    press("Enter");
    await settle(50);
    expect(earned()).toHaveLength(count);
  });

  it("takes no swap before a run", async () => {
    const { earned, wander } = await opened();
    wander();
    expect(earned()).toEqual([]);
  });

  it("pauses on P and on the button, takes no swap while paused, and goes on after", async () => {
    const { earned, el, press, wander, window } = await opened();
    press("Enter");
    await settle(100);
    press("KeyP");
    expect(el("pause")?.textContent).toBe("Resume");
    expect(el("note")?.textContent).toBe(pauseCopy.paused);
    wander();
    expect(earned()).toEqual([]);
    press("KeyP");
    expect(el("pause")?.textContent).toBe("Pause");
    wander();
    expect(earned()).toContain("first-swap");
    el("pause")?.dispatchEvent(new window.MouseEvent("click"));
    expect(el("pause")?.textContent).toBe("Resume");
  });

  it("ends a run when the swaps are used up, saves the best, and says nothing about the platform", async () => {
    const { ended, el, press, stored, wander } = await opened();
    press("Enter");
    await settle(100);
    for (let at = 0; at < 800 && !ended(); at += 1) wander(1);
    // The run closes when the playback of its last swap is over.
    for (let at = 0; at < 60 && el("start")?.hasAttribute("hidden"); at += 1)
      await settle(50);
    expect(el("start")?.hasAttribute("hidden")).toBe(false);
    expect(el("start")?.textContent).toBe("Play again");
    expect(el("note")?.textContent).not.toMatch(/platform|claim|seed/i);
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
    expect(el("pause")?.hasAttribute("disabled")).toBe(true);
  }, 240_000);

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
