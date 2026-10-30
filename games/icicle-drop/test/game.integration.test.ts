import { defaultSound } from "@ador/game-sdk/audio/settings";
import { afterEach, describe, expect, it } from "vitest";

import { closeGame, play, settle } from "./support/page.ts";

afterEach(closeGame);

describe("Icicle Drop, bundled and run against a simulated platform", () => {
  it("connects, and lets the player start only once it has", async () => {
    const { window } = await play();
    await settle();
    expect(window.document.getElementById("status")?.textContent).toBe(
      "Connected.",
    );
    expect(
      window.document.getElementById("start")?.hasAttribute("disabled"),
    ).toBe(false);
    for (const button of window.document.querySelectorAll("#pad button"))
      expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 4321 });
    await settle();
    expect(window.document.getElementById("best")?.textContent).toBe("4321");
  });

  it("starts a run on a seed of its own, says the run is its own report, and moves the tiles", async () => {
    const { window } = await play({ best: 0 });
    await settle();
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    expect(window.document.getElementById("note")?.textContent).toContain(
      "local seed",
    );
    const tiles = () =>
      [...window.document.querySelectorAll("#board .tile")].map(
        (tile) => tile.textContent,
      );
    expect(tiles().filter((text) => text !== "")).toHaveLength(2);
    // Press each direction until one moves the tiles: the board is random, so one of them may change nothing.
    for (const direction of ["left", "down", "right", "up"])
      window.document
        .querySelector(`#pad [data-direction="${direction}"]`)
        ?.dispatchEvent(new window.MouseEvent("click"));
    expect(
      Number(window.document.getElementById("moves")?.textContent),
    ).toBeGreaterThan(0);
    expect(tiles().filter((text) => text !== "").length).toBeGreaterThan(2);
  });

  it("moves the tiles from the keyboard, and a run ends with a note about what the platform could not check", async () => {
    const { stored, window } = await play({ best: 0 });
    await settle();
    window.document
      .getElementById("start")
      ?.dispatchEvent(new window.MouseEvent("click"));
    await settle(100);
    // Play until no move is left: a corner-hugging order gets a run to an end well inside the limit.
    for (let at = 0; at < 3_000; at += 1) {
      const code = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"][at % 4];
      window.dispatchEvent(new window.KeyboardEvent("keydown", { code }));
      if (
        window.document
          .getElementById("note")
          ?.textContent?.includes("your own claim")
      )
        break;
    }
    await settle(100);
    expect(window.document.getElementById("note")?.textContent).toContain(
      "your own claim",
    );
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
  }, 20_000);

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
