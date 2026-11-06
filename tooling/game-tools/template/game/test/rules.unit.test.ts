import { describe, expect, it } from "vitest";

import {
  catchesPerSpeedStep,
  laneWidth,
  maxTicks,
  startSpeed,
  topSpeed,
  zoneHalfWidth,
} from "../src/rules/constants.ts";
import { starterRules } from "../src/rules/index.ts";
import { advance, speedFor, startRun } from "../src/rules/state.ts";
import { catchTick, missTick, play, started } from "./support/bot.ts";

const tap = (state: Parameters<typeof starterRules.step>[0], tick: unknown) =>
  starterRules.step(state, { data: { tick } as never, type: "tap" });

describe("a run starting", () => {
  it("is the same for the same seed and different across seeds, with the marker at the start of the lane and the first zone inside it", () => {
    expect(startRun(7)).toEqual(startRun(7));
    // Seeds are 32 bits wide; spread them out, since the first number of a generator hardly differs between neighbouring ones.
    const zones = new Set(
      Array.from(
        { length: 50 },
        (_, at) => startRun(Math.imul(at + 1, 2_654_435_761) >>> 0).zone,
      ),
    );
    expect(zones.size).toBeGreaterThan(10);
    for (let seed = 0; seed < 200; seed += 1) {
      const state = startRun(seed);
      expect(state).toMatchObject({
        ended: false,
        position: 0,
        score: 0,
        speed: startSpeed,
        tick: 0,
      });
      expect(state.zone).toBeGreaterThanOrEqual(zoneHalfWidth);
      expect(state.zone).toBeLessThanOrEqual(laneWidth - zoneHalfWidth);
    }
  });

  it("takes no settings, and says which one it refused", () => {
    expect(starterRules.init(1, {}).ok).toBe(true);
    expect(starterRules.init(1, { hard: true })).toEqual({
      ok: false,
      reason: "no such setting: hard",
    });
  });
});

describe("the marker", () => {
  it("moves its speed in units a tick, turns round at the far end and again at the start, and is where it is whichever way it is counted", () => {
    const state = started(7);
    expect(advance(state, 10).position).toBe(10);
    const far = advance(state, 120);
    expect(far.position).toBe(80);
    expect(far.direction).toBe(-1);
    const back = advance(state, 220);
    expect(back.position).toBe(20);
    expect(back.direction).toBe(1);
    expect(advance(advance(state, 70), 120)).toEqual(far);
  });

  it("turns round by the distance it overshot the end by, at either end, when its speed does not land it on the end", () => {
    const fast = { ...started(3), speed: 3 };
    expect(advance(fast, 34)).toMatchObject({ direction: -1, position: 98 });
    expect(advance(fast, 67)).toMatchObject({ direction: 1, position: 1 });
  });

  it("goes faster for every five catches, up to a top speed", () => {
    expect(speedFor(0)).toBe(startSpeed);
    expect(speedFor(catchesPerSpeedStep - 1)).toBe(startSpeed);
    expect(speedFor(catchesPerSpeedStep)).toBe(startSpeed + 1);
    expect(speedFor(1_000)).toBe(topSpeed);
  });

  it("stays in the lane at every speed", () => {
    for (const speed of [1, 2, 3]) {
      const state = { ...started(3), speed };
      for (let tick = 0; tick < 600; tick += 7) {
        const { position } = advance(state, tick);
        expect(position).toBeGreaterThanOrEqual(0);
        expect(position).toBeLessThanOrEqual(laneWidth);
      }
    }
  });
});

describe("a tap", () => {
  it("catches when the marker is in the zone: a point, a new zone, and the run goes on", () => {
    const state = started(7);
    const tick = catchTick(state);
    const stepped = tap(state, tick);
    expect(stepped.ok).toBe(true);
    if (!stepped.ok) return;
    expect(stepped.state).toMatchObject({
      ended: false,
      lastTap: tick,
      score: 1,
      tick,
    });
    expect(stepped.state.zone).not.toBe(state.zone);
  });

  it("ends the run when the marker is out of the zone, and says why", () => {
    const state = started(7);
    const stepped = tap(state, missTick(state));
    expect(stepped.ok && stepped.state).toMatchObject({
      cause: "missed",
      ended: true,
      score: 0,
    });
  });

  it("speeds the marker up on the fifth catch, and not before", () => {
    expect(play(7, catchesPerSpeedStep - 1).state.speed).toBe(startSpeed);
    expect(play(7, catchesPerSpeedStep).state.speed).toBe(startSpeed + 1);
  });

  it("is refused for a tick that is not a whole number, is past, is too late, or is on or before the last tap", () => {
    const { state } = play(7, 1);
    for (const bad of [1.5, "9", null, -1, maxTicks + 1])
      expect(tap(state, bad).ok).toBe(false);
    expect(tap(state, state.lastTap)).toEqual({
      ok: false,
      reason: "a tap cannot come on or before the last tap's tick",
    });
    expect(tap(state, state.lastTap - 1).ok).toBe(false);
  });

  it("is refused with a field too many or too few", () => {
    const state = started(7);
    expect(
      starterRules.step(state, { data: { extra: 1, tick: 5 }, type: "tap" }).ok,
    ).toBe(false);
    expect(starterRules.step(state, { type: "tap" }).ok).toBe(false);
  });
});

describe("the end of a run", () => {
  it("is closed by an end input, which keeps the score and says it ran out of time", () => {
    const { state } = play(7, 3);
    const closed = starterRules.step(state, {
      data: { tick: state.tick + 50 },
      type: "end",
    });
    expect(closed.ok && closed.state).toMatchObject({
      cause: "timeout",
      ended: true,
      score: 3,
    });
    expect(
      starterRules.step(state, { data: { tick: 0 }, type: "end" }).ok,
    ).toBe(false);
  });

  it("refuses everything once it has ended, and any input it does not know", () => {
    const { state } = play(7, 1, true);
    expect(state.ended).toBe(true);
    expect(tap(state, state.tick + 1)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(starterRules.step(started(7), { data: {}, type: "jump" })).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
  });
});
