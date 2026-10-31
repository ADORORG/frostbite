import { describe, expect, it } from "vitest";

import {
  bounce,
  fireCooldown,
  gloomHeight,
  groundRow,
  heroHeight,
  invulnerableTicks,
  jumpSpeed,
  maxHearts,
  tile,
} from "../src/rules/hills/constants.ts";
import { hillsChapter, hillsRules } from "../src/rules/hills/index.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { tickHills } from "../src/rules/hills/tick.ts";
import type { HillsState } from "../src/rules/hills/types.ts";
import { flatHills, peak, press, ticks } from "./support/hills-world.ts";

const ground = groundRow * tile;
// Plays on until Glitchy loses a heart (or 600 ticks go by).
function untilHurt(state: HillsState): HillsState {
  let now = state;
  for (let at = 0; at < 600 && now.heartsLost === state.heartsLost; at += 1)
    now = tickHills(now);
  return now;
}
const step = hillsRules.step;

describe("Egg Hills' rules", () => {
  it("start from the seed alone, and take no settings", () => {
    expect(startHills(5)).toEqual(startHills(5));
    expect(startHills(5).level.eggs).not.toEqual(startHills(6).level.eggs);
    expect(hillsRules.init(5, {})).toEqual({ ok: true, state: startHills(5) });
    expect(hillsRules.init(5, { speed: 2 })).toEqual({
      ok: false,
      reason: "no such setting: speed",
    });
  });

  it("refuse an input they do not know, a bad press, a tick gone by, a control already held, and anything after the end", () => {
    const start = startHills(5);
    const refused = (type: string, data: unknown) => {
      const stepped = step(start, { data: data as never, type });
      return stepped.ok ? "" : stepped.reason;
    };
    expect(refused("dance", { on: 1, tick: 0 })).toBe("no such input: dance");
    expect(refused("jump", { on: 2, tick: 0 })).toBe(
      "on must be 1 (pressed) or 0 (released)",
    );
    expect(refused("jump", { on: 0, tick: 0 })).toBe(
      "jump is already released",
    );
    expect(refused("jump", { tick: 0 })).not.toBe("");
    const later = press(ticks(start, 10), "right");
    const back = step(later, { data: { on: 1, tick: 3 }, type: "jump" });
    expect(back.ok).toBe(false);
    const ended = step(start, { data: { tick: 4 }, type: "end" });
    expect(ended.ok && ended.state.ended && ended.state.tick).toBe(4);
    if (!ended.ok) return;
    expect(step(ended.state, { data: { tick: 4 }, type: "end" })).toEqual({
      ok: false,
      reason: "the run has ended",
    });
  });

  it("play the ticks between two inputs, and give the same run for the same inputs", () => {
    const first = press(press(startHills(9), "right"), "jump");
    const moved = step(first, { data: { on: 0, tick: 120 }, type: "right" });
    expect(moved.ok && moved.state.tick).toBe(120);
    expect(moved.ok && moved.state.hero.x).toBeGreaterThan(first.hero.x);
    const again = step(press(press(startHills(9), "right"), "jump"), {
      data: { on: 0, tick: 120 },
      type: "right",
    });
    expect(again).toEqual(moved);
  });

  it("jump higher while jump is held than for a tap, and not at all in the air", () => {
    const standing = flatHills();
    const held = peak(press(standing, "jump"), 40);
    const tapped = peak(press(press(standing, "jump"), "jump", false), 40);
    expect(held).toBeLessThan(tapped);
    expect(tapped).toBeLessThan(standing.hero.y);
    const floating = flatHills(
      {},
      {
        hero: { ...standing.hero, grounded: false, vy: 0, y: ground - 900 },
      },
    );
    expect(tickHills(press(floating, "jump")).hero.vy).toBeGreaterThan(0);
  });

  it("remember a jump pressed just before landing, and allow one just after running off an edge", () => {
    const standing = flatHills();
    const falling = {
      ...standing.hero,
      grounded: false,
      vy: 0,
      y: standing.hero.y - 64,
    };
    const early = ticks(press(flatHills({}, { hero: falling }), "jump"), 8);
    expect(early.hero.vy).toBeLessThan(0);
    expect(ticks(flatHills({}, { hero: falling }), 8).hero.vy).toBe(0);
    const overPit = {
      ...falling,
      coyote: 3,
      y: standing.hero.y + 32,
    };
    const late = tickHills(
      press(flatHills({ pits: [2, 3] }, { hero: overPit }), "jump"),
    );
    expect(late.hero.vy).toBe(-jumpSpeed + 4);
  });

  it("breathe fire only after the berry, with a pause between puffs and no more than two in the air", () => {
    const cold = press(flatHills(), "fire");
    expect(cold.breaths).toBe(0);
    const hot = flatHills({}, { hasFire: true });
    const once = press(press(hot, "fire"), "fire", false);
    expect(once.breaths).toBe(1);
    expect(press(once, "fire").breaths).toBe(1);
    const twice = press(
      press(ticks(once, fireCooldown), "fire"),
      "fire",
      false,
    );
    expect(twice.fireballs).toHaveLength(2);
    const third = press(ticks(twice, fireCooldown), "fire");
    expect(third.fireballs).toHaveLength(2);
    expect(third.breaths).toBe(2);
  });

  it("eat the berry, catch eggs and the golden egg by touching them", () => {
    const on = { x: 3 * tile, y: ground - 4 * 16 };
    const state = flatHills({
      berry: on,
      eggs: [on, { x: 9 * tile, y: 0 }],
      golden: on,
    });
    const touched = ticks(press(state, "right"), 30);
    expect(touched.hasFire).toBe(true);
    expect(touched.eggsTaken).toEqual([true, false]);
    expect(touched.goldens).toBe(1);
    expect(ticks(touched, 30).goldens).toBe(1);
  });

  it("melt a whole ice wall with one puff, and let Glitchy through after", () => {
    const wall = [5, 6, 4].map((row) => ({ column: 6, row }));
    const state = flatHills({ ice: wall }, { hasFire: true });
    const blocked = ticks(press(state, "right"), 120);
    expect(blocked.hero.x).toBeLessThan(6 * tile);
    const melted = ticks(press(state, "fire"), 30);
    expect(melted.melted).toEqual([true, true, true]);
    expect(melted.meltedCount).toBe(3);
    expect(melted.fireballs).toHaveLength(0);
    expect(ticks(press(melted, "right"), 120).hero.x).toBeGreaterThan(6 * tile);
  });

  it("cheer up a gloomling with a puff of fire, or by landing on it, with a bounce", () => {
    const patrol = {
      maxX: 10 * tile,
      minX: 5 * tile,
      x: 6 * tile,
      y: ground - gloomHeight,
    };
    const fired = ticks(
      press(flatHills({ patrols: [patrol] }, { hasFire: true }), "fire"),
      30,
    );
    expect(fired.cheers).toBe(1);
    expect(fired.glooms[0]?.alive).toBe(false);
    const above = flatHills(
      { patrols: [patrol] },
      {
        hero: {
          ...startHills(1).hero,
          grounded: false,
          vy: 30,
          x: patrol.x,
          y: patrol.y - heroHeight - 20,
        },
      },
    );
    const landed = tickHills(above);
    expect(landed.cheers).toBe(1);
    expect(landed.hero.vy).toBe(-bounce);
    expect(landed.hearts).toBe(above.hearts);
  });

  it("lose a heart to a gloomling met from the side or a thorn, and not again while blinking", () => {
    const patrol = {
      maxX: 10 * tile,
      minX: 2 * tile,
      x: 2 * tile + 100,
      y: ground - gloomHeight,
    };
    const bumped = tickHills(flatHills({ patrols: [patrol] }));
    expect(bumped.hearts).toBe(2);
    expect(bumped.heartsLost).toBe(1);
    expect(bumped.invulnerable).toBe(invulnerableTicks);
    const thorny = flatHills({ thorns: [{ x: 2 * tile, y: ground - 9 * 16 }] });
    const pricked = ticks(thorny, 20);
    expect(pricked.hearts).toBe(2);
    expect(ticks(pricked, invulnerableTicks).hearts).toBeLessThan(2);
  });

  it("send Glitchy back after a fall into a pit, to the nest once it is passed, and end the run with the last heart", () => {
    const pit = flatHills({ pits: [4, 5, 6] });
    const fell = untilHurt(press(pit, "right"));
    expect(fell.hearts).toBe(2);
    expect(fell.hero.x).toBe(2 * tile);
    const passed = flatHills(
      { pits: [80, 81, 82] },
      { checkpoint: true, hero: { ...pit.hero, x: 78 * tile } },
    );
    const back = untilHurt(press(passed, "right"));
    expect(back.hero.x).toBe(back.level.checkpointX);
    const last = untilHurt(press({ ...pit, hearts: 1 }, "right"));
    expect(last.over).toBe(true);
    expect(hillsChapter.done(last)).toBe(true);
    expect(
      step(last, { data: { on: 1, tick: last.tick }, type: "jump" }),
    ).toEqual({
      ok: false,
      reason: "the run is over",
    });
    expect(tickHills(last).tick).toBe(last.tick + 1);
  });

  it("count a stage at the portal, begin the next with a heart for each of the first two, and finish after the third", () => {
    const near = (stage: number, hearts: number) =>
      flatHills(
        {},
        { hearts, hero: { ...startHills(1).hero, x: 145 * tile }, stage },
      );
    const second = ticks(press(near(1, 3), "right"), 20);
    expect(second.stage).toBe(2);
    expect(second.stagesCleared).toBe(1);
    expect(second.hearts).toBe(4);
    expect(second.level.stage).toBe(2);
    expect(ticks(press(near(2, maxHearts), "right"), 20).hearts).toBe(
      maxHearts,
    );
    const done = ticks(press(near(3, 2), "right"), 20);
    expect(done.finishTick).not.toBeNull();
    expect(done.stage).toBe(3);
    expect(done.hearts).toBe(2);
    expect(hillsChapter.done(done)).toBe(true);
  });
});
