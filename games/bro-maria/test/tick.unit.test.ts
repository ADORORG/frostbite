import { describe, expect, it } from "vitest";

import {
  bounce,
  bounceHeld,
  coinSize,
  groundRow,
  hitKnock,
  invulnerableTicks,
  playerHeight,
  slimeHeight,
  slimeSpeed,
  startLives,
  tile,
  urchinHeight,
} from "../src/rules/constants.ts";
import { advanceTo, tickOnce } from "../src/rules/tick.ts";
import { flatLevel, holding, onFlat, withHero } from "./support/states.ts";

const floor = groundRow * tile;
const standingY = floor - playerHeight;

describe("a tick of the world", () => {
  it("moves the hero on with what is held, and counts the tick", () => {
    const state = holding(onFlat(), { right: true });
    const next = tickOnce(state);
    expect(next.tick).toBe(1);
    expect(next.hero.x).toBeGreaterThan(state.hero.x);
    expect(advanceTo(state, 25).tick).toBe(25);
    expect(advanceTo(state, 0)).toBe(state);
  });

  it("takes a coin the hero touches, once, and leaves the others", () => {
    const level = flatLevel({
      coins: [
        { x: 10 * tile + 32, y: standingY + 32 },
        { x: 30 * tile, y: standingY },
      ],
    });
    const next = tickOnce(onFlat(level));
    expect(next.coinsTaken).toEqual([true, false]);
    expect(tickOnce(next).coinsTaken).toEqual([true, false]);
    expect(coinSize).toBeLessThan(tile);
  });

  it("walks a slime between the ends of its patch and turns it round at each", () => {
    const level = flatLevel({
      patrols: [
        {
          maxX: 40 * tile + 12,
          minX: 40 * tile,
          x: 40 * tile,
          y: floor - slimeHeight,
        },
      ],
    });
    let state = onFlat(level, 2);
    const seen: number[] = [];
    for (let tick = 0; tick < 6; tick += 1) {
      state = tickOnce(state);
      seen.push(state.slimes[0]?.x ?? 0);
    }
    expect(seen).toEqual([
      40 * tile + slimeSpeed,
      40 * tile + 12,
      40 * tile + 6,
      40 * tile,
      40 * tile + slimeSpeed,
      40 * tile + 12,
    ]);
  });
});

describe("a slime", () => {
  const level = flatLevel({
    patrols: [
      {
        maxX: 20 * tile,
        minX: 10 * tile,
        x: 10 * tile + 16,
        y: floor - slimeHeight,
      },
    ],
  });
  const above = (held: boolean) =>
    holding(
      withHero(onFlat(level), {
        grounded: false,
        vy: 40,
        x: 10 * tile + 16 - 40,
        y: floor - slimeHeight - playerHeight - 20,
      }),
      { jump: held },
    );

  it("is stomped by a hero coming down on it, who bounces, and is counted with a combo", () => {
    let state = above(false);
    for (let tick = 0; tick < 10 && state.stomps === 0; tick += 1)
      state = tickOnce(state);
    expect(state.stomps).toBe(1);
    expect(state.slimes[0]?.alive).toBe(false);
    expect(state.combo).toBe(1);
    expect(state.bestCombo).toBe(1);
    expect(state.hero.vy).toBe(-bounce);
    expect(state.lives).toBe(startLives);
  });

  it("bounces higher when the jump button is held", () => {
    let state = above(true);
    for (let tick = 0; tick < 10 && state.stomps === 0; tick += 1)
      state = tickOnce(state);
    expect(state.hero.vy).toBe(-bounceHeld);
  });

  it("ends the combo when the hero lands", () => {
    let state = above(false);
    for (
      let tick = 0;
      tick < 80 && !(state.stomps > 0 && state.hero.grounded);
      tick += 1
    )
      state = tickOnce(state);
    expect(state.combo).toBe(0);
    expect(state.bestCombo).toBe(1);
  });

  it("hurts a hero who runs into it from the side: a life lost, a knock upward, and a spell of safety", () => {
    const side = holding(
      withHero(onFlat(level), { x: 10 * tile + 16 - 150, vx: 10 }),
      { right: true },
    );
    let state = side;
    for (let tick = 0; tick < 30 && state.hits === 0; tick += 1)
      state = tickOnce(state);
    expect(state.hits).toBe(1);
    expect(state.lives).toBe(startLives - 1);
    expect(state.invulnerable).toBe(invulnerableTicks);
    expect(state.hero.vy).toBeLessThan(0);
    expect(state.hero.vy).toBeGreaterThanOrEqual(-hitKnock);
    expect(state.slimes[0]?.alive).toBe(true);
  });

  it("does not hurt a hero who is safe, and a safe hero is not hit again", () => {
    const safe = {
      ...holding(withHero(onFlat(level), { x: 10 * tile + 16 - 100 }), {
        right: true,
      }),
      invulnerable: 50,
    };
    let state = safe;
    for (let tick = 0; tick < 20; tick += 1) state = tickOnce(state);
    expect(state.hits).toBe(0);
    expect(state.lives).toBe(startLives);
    expect(state.invulnerable).toBe(30);
  });

  it("is passed over by a hero rising through it: not a stomp", () => {
    const rising = withHero(onFlat(level), {
      grounded: false,
      vy: -30,
      x: 10 * tile + 16,
      y: floor - playerHeight - 20,
    });
    const next = tickOnce(rising);
    expect(next.stomps).toBe(0);
    expect(next.hits).toBe(1);
  });

  it("is not stomped by a hero going up, even one whose feet are barely into it", () => {
    const shallow = withHero(onFlat(level), {
      grounded: false,
      vy: -30,
      x: 10 * tile + 16,
      y: floor - slimeHeight - playerHeight + 50,
    });
    const next = tickOnce(shallow);
    expect(next.stomps).toBe(0);
    expect(next.slimes[0]?.alive).toBe(true);
  });

  it("is no longer there once stomped", () => {
    let state = above(false);
    for (let tick = 0; tick < 10 && state.stomps === 0; tick += 1)
      state = tickOnce(state);
    const walked = state.slimes[0]?.x;
    expect(tickOnce(state).slimes[0]?.x).toBe(walked);
    expect(tickOnce(state).stomps).toBe(1);
  });
});

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
