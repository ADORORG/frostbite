import { defaultSound } from "@ador/game-sdk/audio/settings";
import { afterEach, describe, expect, it } from "vitest";

import { byId, closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

describe("Tower Stacker, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "drop")?.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 41 });
    await settle();
    expect(byId(window, "best")?.textContent).toBe("41");
  });

  it("starts a run on a seed of its own, says the run is its own report, and runs until a drop misses", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("local seed");
    expect(byId(window, "drop")?.hasAttribute("disabled")).toBe(false);
    // Dropping on whatever tick the click lands on, the tower narrows until a drop misses it.
    for (
      let at = 0;
      at < 400 && byId(window, "start")?.hasAttribute("hidden");
      at += 1
    ) {
      byId(window, "drop")?.dispatchEvent(new window.MouseEvent("click"));
      await settle(35);
    }
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Run again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "note")?.textContent).toContain("your own claim");
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
    expect(Number(byId(window, "height")?.textContent)).toBeGreaterThan(0);
  }, 40_000);

  it("says so when the platform does not answer, and can still be played", async () => {
    const { window } = await play(undefined, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "The platform said: unavailable",
    );
    expect(
      window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
  });
});
