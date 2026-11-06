import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { maxTicks } from "../src/rules/constants.ts";
import { starterRules } from "../src/rules/index.ts";
import { advance } from "../src/rules/state.ts";
import { createRunSession } from "../src/session.ts";
import { catchTick, missTick } from "./support/bot.ts";

function toTick(session: ReturnType<typeof createRunSession>, tick: number) {
  while (session.clock() < tick) {
    // A run that has ended no longer counts ticks, so waiting on it would never finish.
    if (session.state().ended) throw new Error("the run ended before the tick");
    session.tick();
  }
}
const nextCatch = (session: ReturnType<typeof createRunSession>) =>
  catchTick(session.state());

describe("a session", () => {
  it("counts ticks, and says where the marker is on the tick it is on", () => {
    const session = createRunSession({ seed: 7 });
    expect(session.clock()).toBe(0);
    toTick(session, 12);
    expect(session.clock()).toBe(12);
    expect(session.markerAt()).toBe(advance(session.state(), 12).position);
  });

  it("scores a catch on the tick it is made on, and records only the taps", () => {
    const session = createRunSession({ seed: 7 });
    toTick(session, nextCatch(session));
    expect(session.tap()).toEqual({ ok: true });
    expect(session.state().score).toBe(1);
    const record = session.record();
    expect(record.inputs.map(({ type }) => type)).toEqual(["tap", "end"]);
  });

  it("ends the run on a miss, refuses another tap and records the miss once", () => {
    const session = createRunSession({ seed: 7 });
    toTick(session, missTick(session.state()));
    expect(session.tap()).toEqual({ ok: true });
    expect(session.state()).toMatchObject({ cause: "missed", ended: true });
    expect(session.tap()).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(session.record().inputs.map(({ type }) => type)).toEqual(["tap"]);
  });

  it("refuses a second tap on the same tick, and does not record it", () => {
    const session = createRunSession({ seed: 7 });
    toTick(session, nextCatch(session));
    session.tap();
    expect(session.tap().ok).toBe(false);
    expect(
      session.record().inputs.filter(({ type }) => type === "tap"),
    ).toHaveLength(1);
  });

  it("tells the page of a milestone once, when the tap that earned it is made", () => {
    const onEarned = vi.fn();
    const session = createRunSession({ onEarned, seed: 7 });
    toTick(session, nextCatch(session));
    session.tap();
    expect(onEarned).toHaveBeenCalledTimes(1);
    expect(onEarned).toHaveBeenCalledWith("first-catch");
    toTick(session, nextCatch(session));
    session.tap();
    expect(onEarned).toHaveBeenCalledTimes(1);
    expect(session.earned()).toEqual(["first-catch"]);
  });

  it("closes a run that has gone on as long as it may, and stops counting", () => {
    const session = createRunSession({ seed: 7 });
    toTick(session, maxTicks);
    expect(session.state()).toMatchObject({ cause: "timeout", ended: true });
    session.tick();
    expect(session.clock()).toBe(maxTicks);
  });

  it("gives a record the platform's rules replay to the same score, however the run ended", () => {
    const session = createRunSession({ seed: 99 });
    for (let at = 0; at < 8; at += 1) {
      toTick(session, nextCatch(session));
      session.tap();
    }
    const record = session.record();
    expect(replayRecord(starterRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    expect(record.claims).toEqual(["first-catch", "first-five"]);
    expect(session.record()).toEqual(record);
  });
});
