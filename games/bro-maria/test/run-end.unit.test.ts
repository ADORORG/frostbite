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
