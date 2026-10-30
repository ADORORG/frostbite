import { defaultSound } from "@ador/game-sdk/audio/settings";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

// A seed (29) whose level has a pit within reach of a hero who only runs right, so a run can be played to its end in about ten seconds.
const earlyPit = 29.5 / 0x1_0000_0000;
const byId = (window: Awaited<ReturnType<typeof play>>["window"], id: string) =>
  window.document.getElementById(id);

describe("Bro Maria, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(true);
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("starts a run on a seed of its own, says the run is its own report, and turns on the controls", async () => {
    const { window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("local seed");
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(true);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(false);
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "lives")?.textContent).toBe("3");
    expect(Number(byId(window, "time")?.textContent)).toBeLessThanOrEqual(120);
  });

  it("runs until the last life is lost, then says what the platform could not check and keeps the best", async () => {
    const { stored, window } = await play({ best: 0 });
    window.Math.random = () => earlyPit;
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "ArrowRight" }),
    );
    for (
      let at = 0;
      at < 160 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    )
      await settle(100);
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "start")?.textContent).toBe("Run again");
    expect(byId(window, "lives")?.textContent).toBe("0");
    expect(byId(window, "note")?.textContent).toContain("your own claim");
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
  }, 30_000);

  it("says so when the platform does not answer, and can still be played", async () => {
    const { window } = await play(undefined, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle();
    expect(byId(window, "status")?.textContent).toBe(
      "The platform said: unavailable",
    );
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
  });
});
