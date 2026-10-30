import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { broRules } from "../src/rules/index.ts";
import { startRun } from "../src/rules/state.ts";
import { advanceTo } from "../src/rules/tick.ts";
import { play } from "./support/bot.ts";

const begin = () => {
  const started = broRules.init(5, {});
  if (!started.ok) throw new Error(started.reason);
  return started.state;
};

describe("starting a run", () => {
  it("takes no settings and starts the hero on the ground two tiles in with all its lives", () => {
    expect(broRules.init(5, {}).ok).toBe(true);
    expect(broRules.init(5, { lives: 9 })).toEqual({
      ok: false,
      reason: "no such setting: lives",
    });
    const state = begin();
    expect(state.lives).toBe(3);
    expect(state.hero.grounded).toBe(true);
    expect(state.tick).toBe(0);
    expect(startRun(5).level.ground).toEqual(state.level.ground);
  });
});

describe("a control pressed or let go of", () => {
  it("is held from that tick on, and carries the hero with it", () => {
    const pressed = broRules.step(begin(), {
      data: { on: 1, tick: 4 },
      type: "right",
    });
    if (!pressed.ok) throw new Error(pressed.reason);
    expect(pressed.state.tick).toBe(4);
    expect(pressed.state.controls.right).toBe(true);
    const later = advanceTo(pressed.state, 14);
    expect(later.hero.x).toBeGreaterThan(pressed.state.hero.x);
    const released = broRules.step(later, {
      data: { on: 0, tick: 14 },
      type: "right",
    });
    expect(released.ok && released.state.controls.right).toBe(false);
  });

  it("jumps on a press and not before, and left runs left", () => {
    const left = broRules.step(begin(), {
      data: { on: 1, tick: 0 },
      type: "left",
    });
    expect(left.ok && left.state.controls.left).toBe(true);
    const jump = broRules.step(begin(), {
      data: { on: 1, tick: 0 },
      type: "jump",
    });
    if (!jump.ok) throw new Error(jump.reason);
    expect(jump.state.hero.buffer).toBeGreaterThan(0);
    expect(advanceTo(jump.state, 2).hero.vy).toBeLessThan(0);
  });

  it.each([
    [{ on: 2, tick: 0 }, "on must be 1 (pressed) or 0 (released)"],
    [{ on: "1", tick: 0 }, "on must be 1 (pressed) or 0 (released)"],
    [{ tick: 0 }, "the input takes exactly: on, tick"],
    [{ on: 1, tick: 0, extra: 1 }, "the input takes exactly: on, tick"],
    [{ on: 1, tick: 1.5 }, "tick must be a whole number"],
    [{ on: 1, tick: -1 }, `tick must be from 0 to ${String(maxTicks)}`],
    [
      { on: 1, tick: maxTicks + 1 },
      `tick must be from 0 to ${String(maxTicks)}`,
    ],
    [null, "the input takes an object"],
  ])("refuses a bad input: %j", (data, reason) => {
    expect(broRules.step(begin(), { data, type: "jump" })).toEqual({
      ok: false,
      reason,
    });
  });

  it("refuses a tick that is already past, a control already in that state, and an unknown input", () => {
    const state = advanceTo(begin(), 10);
    expect(
      broRules.step(state, { data: { on: 1, tick: 5 }, type: "jump" }),
    ).toEqual({
      ok: false,
      reason: "tick 5 is already past",
    });
    expect(
      broRules.step(state, { data: { on: 0, tick: 10 }, type: "left" }),
    ).toEqual({
      ok: false,
      reason: "left is already released",
    });
    const held = broRules.step(state, {
      data: { on: 1, tick: 10 },
      type: "left",
    });
    if (!held.ok) throw new Error(held.reason);
    expect(
      broRules.step(held.state, { data: { on: 1, tick: 11 }, type: "left" }),
    ).toEqual({
      ok: false,
      reason: "left is already held",
    });
    expect(broRules.step(state, { type: "fly" })).toEqual({
      ok: false,
      reason: "no such input: fly",
    });
  });
});

describe("the end of a run", () => {
  it("closes the run on the tick it names, and takes nothing after", () => {
    const closed = broRules.step(begin(), { data: { tick: 30 }, type: "end" });
    if (!closed.ok) throw new Error(closed.reason);
    expect(closed.state.ended).toBe(true);
    expect(closed.state.tick).toBe(30);
    expect(
      broRules.step(closed.state, { data: { on: 1, tick: 31 }, type: "jump" }),
    ).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(
      broRules.step(begin(), { data: { tick: 1.5 }, type: "end" }).ok,
    ).toBe(false);
    expect(
      broRules.step(begin(), { data: { tick: 1, extra: 1 }, type: "end" }).ok,
    ).toBe(false);
  });

  it("takes only the end once the hero is out of lives or at the goal", () => {
    const over = { ...begin(), over: true };
    expect(
      broRules.step(over, { data: { on: 1, tick: 0 }, type: "right" }),
    ).toEqual({
      ok: false,
      reason: "the run is over",
    });
    expect(broRules.step(over, { data: { tick: 5 }, type: "end" }).ok).toBe(
      true,
    );
    const won = { ...begin(), finishTick: 3 };
    expect(
      broRules.step(won, { data: { on: 1, tick: 0 }, type: "jump" }).ok,
    ).toBe(false);
  });
});

describe("replaying a played run", () => {
  it("gives the state the player had, and the marks it earned, from the record alone", () => {
    const { inputs, state } = play(31_337);
    const outcome = replayRecord(broRules, {
      claims: [],
      config: {},
      gameId: "bro-maria",
      inputs: [...inputs],
      schemaVersion: 1,
      seed: 31_337,
      verifier: "bro-maria",
      verifierVersion: 1,
    });
    expect(outcome).toEqual({ earned: broRules.earned(state), ok: true });
    expect(broRules.earned(state)).toContain("finish");
  });
});
