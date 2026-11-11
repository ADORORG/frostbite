import { defaultSound } from "@frostbite/game-sdk/audio/settings";
import { recordingRuns } from "@frostbite/test-kit/simulated-game-host";
import { afterEach, describe, expect, it } from "vitest";

import { words } from "../src/words.ts";
import { byId, closeGame, play, settle, until } from "./support/page.ts";

afterEach(closeGame);

describe("Frost Run, bundled and run against a simulated platform", () => {
  it("connects, lets the player start only once it has, and says the run is drawn flat where there is no 3D", async () => {
    const { window } = await play();
    await settle(200);
    expect(byId(window, "status")?.textContent).toBe(words.connected);
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
    expect(byId(window, "pause")?.hasAttribute("disabled")).toBe(true);
    expect(byId(window, "note")?.textContent).toBe(words.flat);
    const layer = [...window.document.querySelectorAll("canvas")].find(
      (canvas) => canvas.style.position === "fixed",
    );
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
  });

  it("carries on from the best the platform hands back", async () => {
    const { window } = await play({ best: 41 });
    await settle(200);
    expect(byId(window, "best")?.textContent).toBe("41");
  });

  it("says so when the platform does not answer, and can still be played", async () => {
    const { window } = await play(undefined, {
      loadProgress: async () => {
        throw new Error("down");
      },
    });
    await settle(200);
    expect(byId(window, "status")?.textContent).toBe(
      "The platform said: unavailable",
    );
    expect(byId(window, "start")?.hasAttribute("disabled")).toBe(false);
  });

  it("sends nothing for a run that was never started", async () => {
    const recorded = recordingRuns();
    const { window } = await play({ best: 0 }, {}, { runs: recorded.runs });
    await settle(200);
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Space" }),
    );
    await settle(100);
    expect(recorded.submitted).toHaveLength(0);
  });

  it("plays a run to its end on the platform's seed, sends it once, saves the best once and offers another", async () => {
    const recorded = recordingRuns();
    const { stored, window } = await play(
      { best: 0 },
      {},
      { runs: recorded.runs },
      true,
    );
    await settle(200);
    byId(window, "start")?.dispatchEvent(new window.MouseEvent("click"));
    await settle(150);
    expect(byId(window, "note")?.textContent).not.toMatch(
      /platform|claim|seed/iu,
    );
    await until(() => recorded.submitted.length > 0, 100_000);
    expect(recorded.submitted).toHaveLength(1);
    expect(recorded.submitted[0]?.runId).toBe("run-1");
    const record = recorded.submitted[0]?.record;
    expect(record).toMatchObject({ gameId: "frost-run", seed: 424_242 });
    const inputs =
      typeof record === "object" && record !== null && "inputs" in record
        ? record.inputs
        : null;
    expect(Array.isArray(inputs) ? inputs[0] : null).toEqual({
      data: 0,
      type: "lead",
    });
    expect(stored.saves).toBe(1);
    expect(stored.progress).toEqual({
      best: expect.any(Number),
      sound: defaultSound,
    });
    await until(() => !byId(window, "result")?.hasAttribute("hidden"), 5000);
    expect(byId(window, "start")?.textContent).toBe(words.playAgain);
    expect(byId(window, "result")?.textContent).toContain(words.lose);
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { code: "Enter" }),
    );
    await settle(200);
    expect(byId(window, "start")?.hasAttribute("hidden")).toBe(true);
    expect(byId(window, "result")?.hasAttribute("hidden")).toBe(true);
  }, 150_000);
});
