import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { maxKeysPerInput, maxTicks } from "../src/rules/constants.ts";
import { permafrostRules } from "../src/rules/index.ts";
import { milestoneIds, milestones } from "../src/rules/milestones.ts";
import { startRun } from "../src/rules/state.ts";
import { close, press } from "./support/drive.ts";
import { stateWith } from "./support/states.ts";

const input = (type: string, data: unknown) => ({ data: data as never, type });
const step = (keys: string) =>
  permafrostRules.step(startRun(1), input("keys", { keys }));

describe("the rules as the platform replays them", () => {
  it("start from a seed and no settings, and refuse any setting", () => {
    expect(permafrostRules.init(7, {})).toMatchObject({ ok: true });
    expect(permafrostRules.init(7, { speed: 2 })).toEqual({
      ok: false,
      reason: "no such setting: speed",
    });
  });

  it("play the same keys out the same way every time", () => {
    const keys = "5l3a10r2d40a7b30d12h9d";
    const one = press(startRun(9), keys);
    expect(press(startRun(9), keys)).toEqual(one);
    expect(press(startRun(10), keys)).not.toEqual(one);
  });

  it("take keys in batches that join up exactly as one long batch does", () => {
    const whole = press(startRun(4), "5l3a10r2d40a7b30d");
    const split = press(press(startRun(4), "5l3a10r"), "2d40a7b30d");
    expect(split).toEqual(whole);
  });

  it("refuse an input it does not know, one with the wrong fields, and keys it cannot read", () => {
    expect(permafrostRules.step(startRun(1), input("jump", {}))).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
    expect(permafrostRules.step(startRun(1), input("keys", {}))).toMatchObject({
      ok: false,
    });
    expect(
      permafrostRules.step(startRun(1), input("keys", { keys: 4 })),
    ).toEqual({
      ok: false,
      reason: "keys must be text",
    });
    expect(step("5x")).toEqual({ ok: false, reason: "no such key: x" });
    expect(step("l".repeat(maxKeysPerInput + 1))).toMatchObject({ ok: false });
    expect(
      permafrostRules.step(startRun(1), input("end", { tick: "5" })),
    ).toMatchObject({ ok: false });
    expect(
      permafrostRules.step(startRun(1), input("end", { tick: 1.5 })),
    ).toMatchObject({ ok: false });
  });

  it("refuse a key past the longest a run may last, and an end before the tick it is on", () => {
    expect(step(`${String(maxTicks + 1)}l`)).toMatchObject({ ok: false });
    expect(step(`${String(maxTicks)}l`)).toMatchObject({ ok: true });
    const later = press(startRun(1), "50l");
    expect(
      permafrostRules.step(later, input("end", { tick: 10 })),
    ).toMatchObject({ ok: false });
    expect(
      permafrostRules.step(later, input("end", { tick: maxTicks + 1 })),
    ).toMatchObject({ ok: false });
  });

  it("score a run only when it has been closed, and then by what it scored", () => {
    const state = stateWith({ score: 1_234 });
    expect(permafrostRules.score?.(state)).toBeNull();
    expect(permafrostRules.score?.(close(state, 5))).toBe(1_234);
  });

  it("refuse anything after a run has been closed", () => {
    const done = close(startRun(1), 5);
    expect(permafrostRules.step(done, input("keys", { keys: "l" }))).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(permafrostRules.step(done, input("end", { tick: 6 }))).toMatchObject(
      { ok: false },
    );
  });

  it("replay a record to the same score and milestones, and a record with no end to none", () => {
    const record = {
      claims: [],
      config: {},
      gameId: "permafrost",
      inputs: [
        input("keys", { keys: "10d20d30d" }),
        input("end", { tick: 200 }),
      ],
      schemaVersion: 1 as const,
      seed: 12,
      verifier: "permafrost",
      verifierVersion: 1,
    };
    const outcome = replayRecord(permafrostRules, record);
    expect(outcome).toMatchObject({ ok: true });
    expect(outcome.ok && outcome.score).toBeGreaterThan(0);
    const open = replayRecord(permafrostRules, {
      ...record,
      inputs: record.inputs.slice(0, 1),
    });
    expect(open).toMatchObject({ ok: true, score: null });
  });
});

describe("the milestones", () => {
  it("have unique ids, thirty-two of them, and none at the very start of a run", () => {
    expect(new Set(milestoneIds).size).toBe(milestoneIds.length);
    expect(milestoneIds).toHaveLength(32);
    expect(permafrostRules.earned(startRun(1))).toEqual([]);
  });

  it("are earned exactly when the state they name is reached", () => {
    const at = (changes: Parameters<typeof stateWith>[0]) =>
      permafrostRules.earned(stateWith(changes));
    expect(at({ lines: 1 })).toEqual(["first-line"]);
    expect(at({ lines: 10 })).toEqual(["first-line", "lines-10"]);
    expect(at({ lines: 24 })).not.toContain("lines-25");
    expect(at({ lines: 25 })).toContain("lines-25");
    expect(at({ lines: 24 })).toContain("level-3");
    expect(at({ lines: 190 })).toContain("level-20");
    expect(at({ lines: 189 })).not.toContain("level-20");
    expect(at({ score: 999 })).toEqual([]);
    expect(at({ score: 1_000 })).toEqual(["score-1k"]);
    expect(at({ fours: 1 })).toEqual(["first-four"]);
    expect(at({ maxCombo: 6 })).toEqual(["combo-3", "combo-6"]);
    expect(at({ backToBackFours: 1 })).toEqual(["back-to-back"]);
    expect(at({ perfectClears: 1 })).toEqual(["perfect-clear"]);
    expect(at({ holdFreeLines: 30 })).toEqual(["no-hold-30"]);
    expect(at({ garbageRows: 10 })).toEqual(["rising-10"]);
  });

  it("count the fortieth line against the clock, the faster the stricter", () => {
    expect(permafrostRules.earned(stateWith({ sprintTick: 180 * 60 }))).toEqual(
      ["sprint-3min"],
    );
    expect(
      permafrostRules.earned(stateWith({ sprintTick: 180 * 60 + 1 })),
    ).toEqual([]);
    expect(permafrostRules.earned(stateWith({ sprintTick: 90 * 60 }))).toEqual([
      "sprint-3min",
      "sprint-90s",
    ]);
    expect(permafrostRules.earned(stateWith({ sprintTick: null }))).toEqual([]);
  });

  it("are each reachable: every one is earned by some state, and ordered so the easy come first", () => {
    const states = [
      stateWith({
        lines: 400,
        score: 1_000_000,
        fours: 99,
        maxCombo: 99,
        backToBackFours: 99,
        perfectClears: 9,
        sprintTick: 100,
        holdFreeLines: 99,
        garbageRows: 99,
      }),
    ];
    for (const state of states)
      expect(permafrostRules.earned(state)).toEqual(milestoneIds);
    expect(milestones.length).toBe(milestoneIds.length);
  });
});
