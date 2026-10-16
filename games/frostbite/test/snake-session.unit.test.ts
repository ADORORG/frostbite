import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { createSnakeSession } from "../src/snake/session.ts";
import { frostbiteRules } from "../src/verifier/frostbite.ts";
import { placeMines } from "../src/verifier/snake-board.ts";
import { targetLength } from "../src/verifier/snake.ts";
import { playSession, winnableSeed } from "./support/snake-solver.ts";

// A seed with a mine in the snake's column outside the clear rows, so steering up (and round the edge) meets it.
export const crashSeed = (() => {
  for (let seed = 1; seed < 500; seed += 1)
    if (placeMines(seed).some(([x]) => x === 6)) return seed;
  throw new Error("No seed has a mine in column 6.");
})();

describe("a SAT SNAKE session", () => {
  it("starts at tick 0 with nothing recorded", () => {
    const session = createSnakeSession({ seed: 1 });
    expect(session.state()).toMatchObject({
      alive: true,
      ended: false,
      tick: 0,
    });
    expect(session.steps()).toBe(0);
    expect(session.earned()).toEqual([]);
  });

  it("moves one cell a tick and records nothing for the moves", () => {
    const session = createSnakeSession({ seed: 1 });
    session.tick();
    session.tick();
    expect(session.state().tick).toBe(2);
    expect(session.state().snake[0]).toEqual([8, 6]);
    expect(session.steps()).toBe(0);
  });

  it("records a turn with the tick it was made on, and not the same direction again", () => {
    const session = createSnakeSession({ seed: 1 });
    session.tick();
    expect(session.turn("up")).toEqual({ ok: true });
    expect(session.turn("up")).toEqual({ ok: true });
    expect(session.steps()).toBe(1);
    expect(session.record().inputs[0]).toEqual({
      data: { dir: "up", tick: 1 },
      type: "turn",
    });
  });

  it("refuses to turn back on itself and records nothing for it", () => {
    const session = createSnakeSession({ seed: 1 });
    expect(session.turn("left")).toEqual({
      ok: false,
      reason: "the snake cannot turn back on itself",
    });
    expect(session.steps()).toBe(0);
    expect(session.state().planned).toBe("right");
  });

  it("closes the run with its record, once, and the record replays to what it claims", () => {
    const session = createSnakeSession({ seed: 1 });
    session.tick();
    const record = session.record();
    expect(record.inputs).toEqual([{ data: { tick: 1 }, type: "end" }]);
    expect(session.record().inputs).toEqual(record.inputs);
    expect(session.steps()).toBe(1);
    expect(record).toMatchObject({
      config: { cabinet: "sat-snake" },
      gameId: "frostbite",
      seed: 1,
      verifier: "frostbite",
      verifierVersion: 2,
    });
    expect(replayRecord(frostbiteRules, record)).toEqual({
      earned: [],
      ok: true,
    });
  });

  it("takes no more turns or moves once the run has ended", () => {
    const session = createSnakeSession({ seed: 1 });
    session.record();
    expect(session.turn("up")).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    session.tick();
    expect(session.state().tick).toBe(0);
  });

  it("ends the run when the snake crashes, and the record still replays", () => {
    const session = createSnakeSession({ seed: crashSeed });
    session.turn("up");
    for (let move = 0; move < 30 && session.state().alive; move += 1)
      session.tick();
    expect(session.state()).toMatchObject({ alive: false, ended: true });
    const record = session.record();
    expect(record.inputs.at(-1)).toMatchObject({ type: "end" });
    expect(replayRecord(frostbiteRules, record).ok).toBe(true);
  });

  it("announces a milestone once, as the move that earned it is made", () => {
    const onEarned = vi.fn();
    const session = playSession(
      winnableSeed(targetLength),
      targetLength,
      onEarned,
    );
    if (session === null) throw new Error("The test player could not win.");
    expect(onEarned.mock.calls).toEqual([["snake-ten"]]);
    session.tick();
    expect(onEarned).toHaveBeenCalledTimes(1);
    expect(session.earned()).toEqual(["snake-ten"]);
    expect(replayRecord(frostbiteRules, session.record())).toEqual({
      earned: ["snake-ten"],
      ok: true,
    });
  });
});
