import {
  ballHeight,
  ballWidth,
  closePit,
  closeSolid,
  coyoteTicks,
  cutSpeed,
  fallDepth,
  gravity,
  hitInset,
  jumpSpeed,
  maxMultiplier,
  maxTicks,
  shardReachX,
  shardReachY,
  subPerMetre,
  topForgive,
} from "./constants.ts";
import { levelAt, speedAt } from "./course.ts";
import { layAhead } from "./spawn.ts";
import type { Obstacle, RunState } from "./types.ts";

// A run is over when the snowball has hit a rock, fallen into a crevasse, or been closed.
export const over = (state: RunState): boolean => !state.alive || state.ended;

const middle = ballWidth / 2;

const multiplier = (streak: number): number =>
  Math.min(maxMultiplier, 1 + streak);

const pitUnder = (
  ahead: readonly Obstacle[],
  centre: number,
): Obstacle | undefined =>
  ahead.find(
    ({ kind, w, x }) => kind === "pit" && centre >= x && centre < x + w,
  );

// A clear scores more the closer it was cut, and a close call in a row multiplies what follows; a plain clear ends the streak.
function clearedOne(state: RunState, kind: Obstacle["kind"], close: boolean) {
  const streak = close ? state.streak + 1 : 0;
  return {
    bestStreak: Math.max(state.bestStreak, streak),
    cleared: { ...state.cleared, [kind]: state.cleared[kind] + 1 },
    closeCalls: state.closeCalls + (close ? 1 : 0),
    score: state.score + (close ? 25 * multiplier(streak) : 10),
    streak,
  };
}

// One tick: a buffered press hops if the snowball can; gravity and the climb move it; the snow rolls on under it; then what it has
// passed is counted, what it has hit or fallen into ends the run, the shards it touches are taken, and more of the slope is laid.
export function tickOnce(before: RunState): RunState {
  if (over(before)) return before;
  const speed = speedAt(levelAt(before.distance));
  let { buffer, coyote, hops, vy, y } = before;
  if (buffer > 0) {
    if (coyote > 0) {
      vy = before.holding ? jumpSpeed : cutSpeed;
      coyote = 0;
      buffer = 0;
      hops += 1;
    } else buffer -= 1;
  }
  const distance = before.distance + speed;
  const centre = distance + middle;
  const pit = pitUnder(before.ahead, centre);
  let landed = false;
  if (y > 0 || vy > 0 || pit !== undefined) {
    vy -= gravity;
    y += vy;
    coyote = Math.max(0, coyote - 1);
    if (y <= 0 && pit === undefined) {
      y = 0;
      vy = 0;
      landed = true;
      coyote = coyoteTicks;
    }
  } else {
    y = 0;
    vy = 0;
    coyote = coyoteTicks;
  }
  const air =
    landed || !(y > 0 || vy > 0 || pit !== undefined) ? 0 : before.air + 1;
  let state: RunState = {
    ...before,
    air,
    buffer,
    coyote,
    distance,
    hops,
    longest: Math.max(before.longest, air),
    peak: Math.max(before.peak, y),
    pitEnd: pit === undefined ? before.pitEnd : pit.x + pit.w,
    score:
      before.score +
      Math.floor(distance / subPerMetre) -
      Math.floor(before.distance / subPerMetre),
    tick: before.tick + 1,
    vy,
    y,
  };
  if (landed && state.pitEnd !== null) {
    state = {
      ...state,
      ...clearedOne(state, "pit", centre - state.pitEnd <= closePit),
      pitEnd: null,
    };
  }
  const left = distance + hitInset;
  const right = distance + ballWidth - hitInset;
  let { lowest } = state;
  const ahead: Obstacle[] = [];
  for (const obstacle of state.ahead) {
    const end = obstacle.x + obstacle.w;
    if (obstacle.kind === "pit") {
      if (end + 4 * ballWidth > left) ahead.push(obstacle);
    } else if (end <= left) {
      state = {
        ...state,
        ...clearedOne(
          state,
          obstacle.kind,
          lowest !== null && lowest <= closeSolid,
        ),
      };
      lowest = null;
    } else {
      ahead.push(obstacle);
      if (right > obstacle.x) {
        if (y + topForgive < obstacle.h)
          return { ...state, ahead, alive: false, cause: "hit", lowest };
        lowest = Math.min(lowest ?? y - obstacle.h, y - obstacle.h);
      }
    }
  }
  let taken = 0;
  const shards = state.shards.filter((shard) => {
    if (shard.x < left - 4 * ballWidth) return false;
    const got =
      Math.abs(centre - shard.x) <= shardReachX &&
      Math.abs(y + ballHeight / 2 - shard.y) <= shardReachY;
    if (got) taken += 1;
    return !got;
  });
  state = {
    ...state,
    ahead,
    lowest,
    score: state.score + taken * 10 * multiplier(state.streak),
    shards,
    shardsTaken: state.shardsTaken + taken,
  };
  if (y < -fallDepth) return { ...state, alive: false, cause: "fell" };
  state = layAhead(state, distance);
  return state.tick >= maxTicks ? { ...state, ended: true } : state;
}

// Lets the run go on to `tick` (it stops where it ends, or at the longest a run may be).
export function advanceTo(state: RunState, tick: number): RunState {
  let current = state;
  const until = Math.min(tick, maxTicks);
  while (!over(current) && current.tick < until) current = tickOnce(current);
  return current;
}
