import { describe, expect, it } from "vitest";

import {
  groundRow,
  invulnerableTicks,
  playerHeight,
  startLives,
  tile,
  urchinHeight,
} from "../src/rules/constants.ts";
import { tickOnce } from "../src/rules/tick.ts";
import type { State } from "../src/rules/types.ts";
import { flatLevel, holding, onFlat, withHero } from "./support/states.ts";

const floor = groundRow * tile;
const standingY = floor - playerHeight;

describe("an urchin, a pit and the end of the run", () => {
  it("hurts a hero who touches it, even one coming down on it", () => {
    const level = flatLevel({
      urchins: [{ x: 12 * tile, y: floor - urchinHeight }],
    });
    const landing = withHero(onFlat(level, 12), {
      grounded: false,
      vy: 30,
      y: floor - playerHeight - 30,
    });
    const state = tickOnce(landing);
    expect(state.hits).toBe(1);
    expect(state.lives).toBe(startLives - 1);
    expect(state.deaths).toBe(0);
  });

  it("puts a hero who falls into a pit back at the start, before the lantern, with a life gone", () => {
    const state = tickOnce(
      withHero(onFlat(), { grounded: false, vy: 40, y: 10 * tile }),
    );
    expect(state.deaths).toBe(1);
    expect(state.hits).toBe(0);
    expect(state.lives).toBe(startLives - 1);
    expect(state.hero.x).toBe(2 * tile);
    expect(state.hero.y).toBe(standingY);
    expect(state.hero.vy).toBe(0);
    expect(state.invulnerable).toBe(invulnerableTicks);
  });

  it("puts a hero who has passed the lantern back at the lantern", () => {
    const passed = { ...onFlat(flatLevel(), 120), checkpoint: true };
    const state = tickOnce(
      withHero(passed, { grounded: false, vy: 40, y: 10 * tile }),
    );
    expect(state.hero.x).toBe(100 * tile);
  });

  it("lights the lantern when the hero reaches it, and notes how far the hero has been", () => {
    const state = tickOnce(withHero(onFlat(), { x: 100 * tile }));
    expect(state.checkpoint).toBe(true);
    expect(state.farthest).toBe(100);
    expect(tickOnce(onFlat()).checkpoint).toBe(false);
    expect(tickOnce(withHero(state, { x: 20 * tile })).checkpoint).toBe(true);
    expect(tickOnce(withHero(state, { x: 5 * tile })).farthest).toBe(100);
  });

  it("ends the run when the last life is lost, and then nothing moves but the clock", () => {
    const last = { ...onFlat(), lives: 1 };
    const over = tickOnce(
      withHero(last, { grounded: false, vy: 40, y: 10 * tile }),
    );
    expect(over.over).toBe(true);
    expect(over.lives).toBe(0);
    const later = tickOnce(holding(over, { right: true }));
    expect(later.hero).toEqual(over.hero);
    expect(later.tick).toBe(over.tick + 1);
  });

  it("finishes the run when the hero reaches the goal of the last stage, and then nothing moves but the clock", () => {
    const level = flatLevel();
    const last = { ...onFlat(level), stage: 6 };
    const nearly = withHero(last, { x: level.goalX - 400 });
    const done = tickOnce(holding(nearly, { right: true }));
    expect(done.finishTick).toBeNull();
    const reached = tickOnce(withHero(last, { x: level.goalX }));
    expect(reached.finishTick).toBe(1);
    expect(reached.stagesCleared).toBe(1);
    const later = tickOnce(holding(reached, { left: true }));
    expect(later.hero).toEqual(reached.hero);
    expect(later.finishTick).toBe(1);
  });

  it("begins the next stage when the goal of an earlier one is reached: a new level, the hero at the start, the stage counted, and a life won on stages two and four", () => {
    const level = flatLevel();
    const at = (stage: number, over: Partial<State> = {}) =>
      tickOnce({
        ...withHero({ ...onFlat(level), stage, tick: 99 }, { x: level.goalX }),
        stageStart: 40,
        ...over,
      });
    const first = at(1, { coinsTaken: [], hits: 0 });
    expect(first.finishTick).toBeNull();
    expect([first.stage, first.stagesCleared, first.level.stage]).toEqual([
      2, 1, 2,
    ]);
    expect(first.hero.x).toBe(2 * tile);
    expect(first.stageStart).toBe(100);
    expect(first.checkpoint).toBe(false);
    expect(first.invulnerable).toBe(invulnerableTicks);
    expect(first.fastest).toBe(60);
    expect(first.lives).toBe(3);
    expect(at(2).lives).toBe(4);
    expect(at(3).lives).toBe(3);
    expect(at(4).lives).toBe(4);
    expect(at(2, { lives: 5 }).lives).toBe(5);
  });

  it("keeps the fewest ticks any stage was cleared in, not the last", () => {
    const level = flatLevel();
    const at = (fastest: number) =>
      tickOnce({
        ...withHero(
          { ...onFlat(level), stage: 2, tick: 99 },
          { x: level.goalX },
        ),
        fastest,
        stageStart: 40,
      });
    expect(at(30).fastest).toBe(30);
    expect(at(500).fastest).toBe(60);
  });

  it("counts a stage clean when it cost nothing, and perfect when every shard was taken, and banks its shards", () => {
    const level = flatLevel({
      coins: [
        { x: 0, y: 0 },
        { x: 99_999, y: 0 },
      ],
    });
    const base = withHero(
      { ...onFlat(level), stage: 2, stageLosses: 3 },
      { x: level.goalX },
    );
    const clean = tickOnce({
      ...base,
      deaths: 1,
      hits: 2,
      coinsTaken: [true, true],
    });
    expect([clean.cleanStages, clean.perfectStages, clean.coinsBanked]).toEqual(
      [1, 1, 2],
    );
    const costly = tickOnce({
      ...base,
      deaths: 1,
      hits: 3,
      coinsTaken: [true, false],
    });
    expect([
      costly.cleanStages,
      costly.perfectStages,
      costly.coinsBanked,
    ]).toEqual([0, 0, 1]);
  });

  it("does not finish a hero who loses the last life to an urchin at the goal", () => {
    const goal = flatLevel().goalX;
    const level = flatLevel({
      urchins: [{ x: goal - 100, y: floor - urchinHeight }],
    });
    const last = { ...onFlat(level, 10), lives: 1 };
    const state = tickOnce(withHero(last, { x: goal - 192 }));
    expect(state.over).toBe(true);
    expect(state.finishTick).toBeNull();
  });

  it("does not finish a hero who has just lost the last life at the goal", () => {
    const level = flatLevel();
    const last = { ...onFlat(level), lives: 1 };
    const state = tickOnce(
      withHero(last, { grounded: false, vy: 40, x: level.goalX, y: 10 * tile }),
    );
    expect(state.over).toBe(true);
  });
});
