// @vitest-environment jsdom
import { replayRecord } from "@ador/game-sdk/replay";
import { runRecordSchema } from "@ador/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { frostbiteRules } from "../src/verifier/frostbite.ts";
import { targetLength } from "../src/verifier/snake.ts";
import {
  button,
  clickButton,
  container,
  host,
  press,
  recordText,
  show,
  startRun,
  stat,
  status,
  ticks,
  turnPad,
} from "./support/snake-screen.tsx";
import { crashSeed } from "./snake-session.unit.test.ts";
import { playSnake, winnableSeed } from "./support/snake-solver.ts";

const seed = 1;
const run = () => runRecordSchema.parse(JSON.parse(recordText()));

describe("the SAT SNAKE screen", () => {
  it("offers a launcher, and opens the cabinet as a dialog with an introduction", async () => {
    await show(seed);
    expect(container.textContent).toBe("Sat snake");
    await clickButton("Sat snake");
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-label")).toBe("Sat snake cabinet");
    expect(document.activeElement).toBe(dialog);
    expect(button("Start a run")).toBeDefined();
    await clickButton("Close");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button("Sat snake"));
  });

  it("closes on Escape", async () => {
    await show(seed);
    await clickButton("Sat snake");
    await press("Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("starts a run on a local seed and says its milestones are the game's own report", async () => {
    await startRun(seed);
    expect(status()).toContain("This run is on a local seed");
    expect(stat("Length")).toBe("3");
    expect(stat("Moves")).toBe("0");
    expect(
      container.querySelector(".sn-board")?.getAttribute("aria-label"),
    ).toContain("The snake is 3 long");
  });

  it("moves the snake a cell on each tick of the timer", async () => {
    await startRun(seed);
    await ticks(3);
    expect(stat("Moves")).toBe("3");
    expect(container.querySelectorAll('[data-kind="head"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-kind="body"]')).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-kind="mine"]').length,
    ).toBeGreaterThan(0);
  });

  it("steers with the arrow keys, WASD and the pad, and says why when a turn is refused", async () => {
    await startRun(seed);
    await press("ArrowUp");
    await press("a");
    expect(status()).toContain("the snake cannot turn back on itself");
    await ticks(1);
    await turnPad("right");
    await press("W");
    await clickButton("End run");
    const { inputs } = run();
    expect(inputs.map((input) => input.type)).toEqual([
      "turn",
      "turn",
      "turn",
      "end",
    ]);
    expect(inputs[0]).toEqual({ data: { dir: "up", tick: 0 }, type: "turn" });
  });

  it("does not steer on a key that is not a direction, and lets the page have the key", async () => {
    await startRun(seed);
    await press("x");
    await clickButton("End run");
    expect(run().inputs).toEqual([{ data: { tick: 0 }, type: "end" }]);
  });

  it("ends the run on End run with a record the platform's rules accept", async () => {
    await startRun(seed);
    await ticks(2);
    await clickButton("End run");
    const record = run();
    expect(container.querySelector(".if-record")?.textContent).toContain(
      "1 steps from seed 1.",
    );
    expect(record.inputs).toEqual([{ data: { tick: 2 }, type: "end" }]);
    expect(replayRecord(frostbiteRules, record)).toEqual({
      earned: [],
      ok: true,
    });
    expect(container.querySelector(".if-note")?.textContent).toContain(
      "not sent to the platform",
    );
  });

  it("stops the clock once the run has ended", async () => {
    await startRun(seed);
    await clickButton("End run");
    await ticks(5);
    expect(run().inputs).toEqual([{ data: { tick: 0 }, type: "end" }]);
  });

  it("ends the run itself when the snake crashes, and says so", async () => {
    await startRun(crashSeed);
    await press("ArrowUp");
    await ticks(40);
    expect(container.querySelector(".if-record")).not.toBeNull();
    expect(container.textContent).toContain("The snake crashed");
    expect(run().inputs.at(-1)?.type).toBe("end");
  });

  it("leaves what the screen says alone when a key is pressed after the run has ended", async () => {
    await startRun(crashSeed);
    await press("ArrowUp");
    await ticks(40);
    await press("ArrowDown");
    expect(container.textContent).toContain("The snake crashed");
    expect(container.textContent).not.toContain("the run has ended");
  });

  it("starts another run from the record", async () => {
    await startRun(seed);
    await clickButton("End run");
    await clickButton("Start another run");
    expect(stat("Moves")).toBe("0");
  });

  it("reports the milestone as soon as the snake is long enough, and the record then earns it", async () => {
    const winning = winnableSeed(targetLength);
    const won = playSnake(winning, targetLength);
    if (won === null) throw new Error("The test player could not win.");
    await startRun(winning);
    for (let tick = 0; tick < won.state.tick; tick += 1) {
      for (const turn of won.turns.filter((t) => t.tick === tick))
        await turnPad(turn.dir);
      await ticks(1);
    }
    expect(host.milestone).toHaveBeenCalledExactlyOnceWith("snakeTen");
    await clickButton("End run");
    expect(replayRecord(frostbiteRules, run())).toEqual({
      earned: ["snake-ten"],
      ok: true,
    });
  });
});
