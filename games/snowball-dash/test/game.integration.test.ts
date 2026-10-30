import { defaultSound } from "@ador/game-sdk/audio/settings";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

const byId = (window: { document: Document }, id: string) =>
  window.document.getElementById(id);

describe("Snowball Dash, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(byId(window, "status")?.textContent).toBe("Connected.");
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "hop")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 321 });
    await settle();
    expect(byId(window, "best")?.textContent).toBe("321");
  });

  it("starts a run on a seed of its own, says the run is its own report, and runs until a rock is hit", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(byId(window, "note")?.textContent).toContain("local seed");
    expect(byId(window, "hop")?.hasAttribute("disabled")).toBe(false);
    // Left alone the snowball meets the first rock in about three seconds, and the run ends.
    await settle(3_500);
    const start = byId(window, "start");
    expect(start?.textContent).toBe("Roll again");
    expect(start?.hasAttribute("hidden")).toBe(false);
    expect(byId(window, "hop")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "note")?.textContent).toContain("your own claim");
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
  }, 15_000);

  it("reports a milestone to the platform once a hop has earned it", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    byId(window, "hop")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(200);
    expect(Object.keys(stored.unlocked)).toEqual(["first-hop"]);
    expect(
      [...window.document.querySelectorAll("#earned li")].map(
        (item) => item.textContent,
      ),
    ).toEqual(["first-hop"]);
  }, 15_000);

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
