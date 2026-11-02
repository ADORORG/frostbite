import { blastAtBoss } from "./boss-meet.ts";
import { solidAt, tilesUnder, touching } from "./collide.ts";
import {
  blastLife,
  blastSize,
  blastSpeed,
  gloomHeight,
  gloomWidth,
  gravity,
  heroHeight,
  heroWidth,
  maxFall,
  mostBlasts,
  rollerSize,
  rows,
  thornHeight,
  thornWidth,
  tile,
} from "./constants.ts";
import { rollerX } from "./secrets.ts";
import { cheer } from "./touch.ts";
import type { Blast, HillsLevel, HillsState } from "./types.ts";

// A glitch blast (a mushroom from the backpack): a ball of glitch that rolls along the ground the way Glitchy faces, a long way, up steps
// a tile high and down every drop. It clears what it meets: a gloomling is cheered up, a thorn bush or a boulder is glitched away, an ice
// wall melts (and the ball rolls on through), and in DeFu's fight a guard goes home and a ghost dragon or the rocket is hit. It bursts
// against anything taller than a step, and is lost down a pit.
export function throwBlast(state: HillsState): HillsState {
  const { hero } = state;
  const blast: Blast = {
    life: blastLife,
    vx: hero.facing * blastSpeed,
    vy: 0,
    x: hero.x + (heroWidth - blastSize) / 2,
    y: hero.y + heroHeight - blastSize,
  };
  return { ...state, blasts: [...state.blasts, blast].slice(-mostBlasts) };
}

const solidIn = (
  level: HillsLevel,
  melted: readonly boolean[],
  x: number,
  y: number,
): boolean =>
  tilesUnder(x, y, blastSize, blastSize).some(([column, row]) =>
    solidAt(level, melted, column, row),
  );

// Every ice wall the ball would touch at (x, y) melts, the whole wall at once: how many blocks melted.
function meltAt(
  level: HillsLevel,
  melted: boolean[],
  x: number,
  y: number,
): number {
  let count = 0;
  for (const [column, row] of tilesUnder(x, y, blastSize, blastSize)) {
    const index = level.iceAt.get(column * 64 + row) ?? -1;
    const wall = level.ice[index];
    if (wall === undefined || melted[index] === true) continue;
    level.ice.forEach((cell, at) => {
      if (cell.column !== wall.column || melted[at] === true) return;
      melted[at] = true;
      count += 1;
    });
  }
  return count;
}

interface Rolled {
  readonly blast: Blast | null;
  readonly melted: number;
}

// One tick of a ball's roll: null once it has burst, fallen away or rolled its length.
function roll(level: HillsLevel, melted: boolean[], blast: Blast): Rolled {
  const x = blast.x + blast.vx;
  const melts = meltAt(level, melted, x, blast.y);
  let { y } = blast;
  if (solidIn(level, melted, x, y)) {
    const climbs =
      !solidIn(level, melted, x, y - tile) &&
      !solidIn(level, melted, blast.x, y - tile);
    if (!climbs) return { blast: null, melted: melts };
    y -= tile;
  }
  let vy = Math.min(blast.vy + gravity, maxFall);
  let down = y + vy;
  if (solidIn(level, melted, x, down)) {
    down = Math.floor((down + blastSize - 1) / tile) * tile - blastSize;
    vy = 0;
  }
  const life = blast.life - 1;
  return life <= 0 || down > rows * tile
    ? { blast: null, melted: melts }
    : { blast: { life, vx: blast.vx, vy, x, y: down }, melted: melts };
}

// Every ball in play rolls on and clears what it touches. `inMain`: Glitchy is in the stage itself (not a secret area), where DeFu is.
export function rollBlasts(state: HillsState, inMain: boolean): HillsState {
  if (state.blasts.length === 0) return state;
  const { level, tick } = state;
  const melted = [...state.melted];
  const thornsGone = [...state.thornsGone];
  const rollersGone = [...state.rollersGone];
  const blasts: Blast[] = [];
  let { boss, glooms } = state;
  let cheers = 0;
  let guards = 0;
  let newly = 0;
  for (const before of state.blasts) {
    const rolled = roll(level, melted, before);
    newly += rolled.melted;
    const ball = rolled.blast;
    if (ball === null) continue;
    blasts.push(ball);
    const on = (x: number, y: number, width: number, height: number) =>
      touching(ball.x, ball.y, blastSize, blastSize, x, y, width, height);
    glooms.forEach((gloom, at) => {
      const patrol = level.patrols[at];
      if (
        gloom.alive &&
        patrol !== undefined &&
        on(gloom.x, patrol.y, gloomWidth, gloomHeight)
      ) {
        glooms = cheer(glooms, at, tick);
        cheers += 1;
      }
    });
    level.thorns.forEach((thorn, at) => {
      if (on(thorn.x, thorn.y, thornWidth, thornHeight)) thornsGone[at] = true;
    });
    level.rollers.forEach((roller, at) => {
      if (on(rollerX(roller, tick), roller.y, rollerSize, rollerSize))
        rollersGone[at] = true;
    });
    if (inMain) {
      const met = blastAtBoss(boss, ball.x, ball.y, blastSize, tick);
      boss = met.boss;
      guards += met.cheered;
    }
  }
  return {
    ...state,
    blasts,
    boss,
    cheers: state.cheers + cheers,
    glooms,
    guardsCheered: state.guardsCheered + guards,
    melted,
    meltedCount: state.meltedCount + newly,
    rollersGone,
    thornsGone,
  };
}
