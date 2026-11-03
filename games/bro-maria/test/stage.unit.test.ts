import { describe, expect, it } from "vitest";

import { invulnerableTicks, tile } from "../src/rules/constants.ts";
import { tickOnce } from "../src/rules/tick.ts";
import type { State } from "../src/rules/types.ts";
import { flatLevel, onFlat, withHero } from "./support/states.ts";

describe("the stages", () => {
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
});
