import {
  blazeLonger,
  fireCooldown,
  fireHeight,
  fireLife,
  fireSpeed,
  fireWidth,
  gloomHeight,
  gloomWidth,
  heroWidth,
  maxFires,
  mouthDrop,
  pixel,
  rainFireLife,
} from "./constants.ts";
import { solidAt, tilesUnder, touching } from "./collide.ts";
import type { Fireball, Gloom, HillsState } from "./types.ts";

// Glitchy's fire. After eating a fire berry, pressing fire breathes a little puff that flies straight ahead (twice as far in a berry's
// blaze): it melts the first ice wall it meets (the whole wall, all at once), cheers up a gloomling it touches (the cloud turns into a
// rainbow puff and floats off), and fizzles against the ground.
export function breathe(state: HillsState): HillsState {
  if (
    !state.hasFire ||
    state.fireCooldown > 0 ||
    state.fireballs.length >= maxFires
  )
    return state;
  const { hero } = state;
  const fireball: Fireball = {
    life:
      (state.level.weather === "rain" ? rainFireLife : fireLife) *
      (state.powers.blaze > 0 ? blazeLonger : 1),
    vx: hero.facing * fireSpeed,
    x:
      hero.facing > 0
        ? hero.x + heroWidth - 2 * pixel
        : hero.x - fireWidth + 2 * pixel,
    y: hero.y + mouthDrop,
  };
  return {
    ...state,
    breaths: state.breaths + 1,
    fireCooldown: fireCooldown,
    fireballs: [...state.fireballs, fireball],
  };
}

export interface Flown {
  readonly cheered: readonly number[];
  readonly fireballs: readonly Fireball[];
  readonly melted: readonly boolean[];
  readonly newlyMelted: number;
}

// One tick of every puff in the air.
export function fly(state: HillsState, glooms: readonly Gloom[]): Flown {
  const melted = [...state.melted];
  const cheered: number[] = [];
  const flying: Fireball[] = [];
  let newlyMelted = 0;
  for (const before of state.fireballs) {
    const ball = { ...before, life: before.life - 1, x: before.x + before.vx };
    const under = tilesUnder(ball.x, ball.y, fireWidth, fireHeight);
    const ice = under
      .map(([column, row]) => state.level.iceAt.get(column * 64 + row))
      .find((index) => index !== undefined && melted[index] !== true);
    const wall = state.level.ice[ice ?? -1];
    if (wall !== undefined) {
      // The whole wall melts at once: every block of ice in that column.
      state.level.ice.forEach((cell, index) => {
        if (cell.column !== wall.column || melted[index] === true) return;
        melted[index] = true;
        newlyMelted += 1;
      });
      continue;
    }
    const target = glooms.findIndex((gloom, at) => {
      const patrol = state.level.patrols[at];
      return (
        gloom.alive &&
        !cheered.includes(at) &&
        patrol !== undefined &&
        touching(
          ball.x,
          ball.y,
          fireWidth,
          fireHeight,
          gloom.x,
          patrol.y,
          gloomWidth,
          gloomHeight,
        )
      );
    });
    if (target >= 0) {
      cheered.push(target);
      continue;
    }
    const blocked = under.some(([column, row]) =>
      solidAt(state.level, melted, column, row),
    );
    if (!blocked && ball.life > 0) flying.push(ball);
  }
  return { cheered, fireballs: flying, melted, newlyMelted };
}
