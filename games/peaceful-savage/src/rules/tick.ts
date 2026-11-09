import { refuse } from "@frostbite/game-sdk/run-inputs";
import type { Stepped } from "@frostbite/game-sdk/run-record";

import {
  clues,
  clueSpot,
  plasmaPerZone,
  plasmaRadius,
  plasmaSpots,
} from "./collect.ts";
import { senseRadius, visionRestTicks, zoneIds } from "./constants.ts";
import { stepToward, within, zoneAt } from "./geometry.ts";
import { greyAt, greyHomes } from "./greys.ts";
import {
  greyAura,
  huddleSkill,
  light,
  mastered,
  spark,
  sparkEvery,
  warmRoom,
  withLight,
  withSpark,
} from "./growth.ts";
import { hillRadius, places, walls } from "./layout.ts";
import { beginMoment, momentTick } from "./moment.ts";
import {
  family,
  visionRadius,
  visionTicks,
  walkSpeed,
  withNews,
} from "./state.ts";
import type { PlayState } from "./types.ts";

// Where a mote of tiny plasma lies.
export function plasmaAt(state: PlayState, mote: number) {
  const zone = Math.floor(mote / plasmaPerZone);
  return plasmaSpots[zone]?.[state.plasmaAt[mote] ?? 0] ?? { x: 0, z: 0 };
}

// Mama Heerah senses what is near: while she is with the lead (or leads), a sly snake close by is seen without Savage Vision.
function sensed(state: PlayState): PlayState {
  if (!family(state).includes("heerah")) return state;
  let found = false;
  const greys = state.greys.map((grey, index) => {
    const home = greyHomes[index];
    if (grey.seen || grey.healed || home === undefined) return grey;
    const near = within(
      state,
      greyAt(home, grey.spot, grey.phase, state.tick),
      senseRadius,
    );
    found ||= near;
    return near ? { ...grey, seen: true } : grey;
  });
  return found ? withNews({ ...state, greys }, "sensed") : state;
}

// In Savage Vision every grey one and every clue near enough is seen, and stays seen.
function seeHidden(state: PlayState): PlayState {
  const radius = visionRadius(state);
  let found = false;
  const greys = state.greys.map((grey, index) => {
    const home = greyHomes[index];
    if (grey.seen || home === undefined) return grey;
    const near = within(
      state,
      greyAt(home, grey.spot, grey.phase, state.tick),
      radius,
    );
    found ||= near;
    return near ? { ...grey, seen: true } : grey;
  });
  const cluesSeen = state.cluesSeen.map((seen, index) => {
    const clue = clues[index];
    if (seen || clue === undefined) return seen;
    const near = within(state, clueSpot(clue, state.clueAt[index]), radius);
    found ||= near;
    return near;
  });
  return found ? { ...state, cluesSeen, greys } : state;
}

// Walking through tiny plasma gathers it: a little light and a little spark each.
function gatherPlasma(state: PlayState): PlayState {
  const room = zoneIds.indexOf(zoneAt(state));
  let gathered = state;
  for (let at = 0; at < plasmaPerZone; at += 1) {
    const mote = room * plasmaPerZone + at;
    if (
      gathered.plasmaTaken[mote] !== false ||
      !within(state, plasmaAt(state, mote), plasmaRadius)
    )
      continue;
    gathered = withNews(
      withSpark(
        withLight(
          {
            ...gathered,
            plasma: gathered.plasma + 1,
            plasmaTaken: gathered.plasmaTaken.map(
              (taken, index) => taken || index === mote,
            ),
          },
          light.plasma,
        ),
        spark.plasma,
      ),
      "plasma",
      String(mote),
    );
  }
  return gathered;
}

// Once a second the spark drifts: down near an unhealed grey one in the same room (even one not yet seen, which is how a lead feels one
// near before seeing it), up with family about or in a room with colour.
function drift(state: PlayState): PlayState {
  if (state.tick % sparkEvery !== 0) return state;
  const room = zoneAt(state);
  const greyNear = state.greys.some((grey, index) => {
    const home = greyHomes[index];
    return (
      home !== undefined &&
      !grey.healed &&
      home.zone === room &&
      within(state, greyAt(home, grey.spot, grey.phase, state.tick), greyAura)
    );
  });
  if (greyNear) return withSpark(state, spark.greyNear);
  const warm =
    state.party.length > 0 ||
    (state.colour[zoneIds.indexOf(room)] ?? 0) >= warmRoom;
  return warm && state.tick % (sparkEvery * 2) === 0
    ? withSpark(state, spark.steadyGain)
    : state;
}

// One tick of the world: a moment's clock, or else the lead's walk, what they gather, how their spark drifts, what vision shows, and
// the hill calling the whole family once the jackets are on and the huddle is mastered.
export function tickOnce(state: PlayState): PlayState {
  const next = { ...state, tick: state.tick + 1 };
  if (next.lead === null || next.ended) return next;
  if (next.moment !== null) return momentTick(next);
  let walked = next;
  if (next.moving >= 0) {
    const to = stepToward(next, next.moving, walkSpeed(next), walls);
    walked = gatherPlasma({ ...next, x: to.x, z: to.z });
  }
  const felt = drift(walked);
  const seen = sensed(felt.tick < felt.visionUntil ? seeHidden(felt) : felt);
  if (
    seen.jackets &&
    family(seen).length === 4 &&
    mastered(seen, huddleSkill) &&
    within(seen, places.hill, hillRadius)
  )
    return withNews(beginMoment(seen, "finale"), "rise");
  return seen;
}

export function advanceTo(state: PlayState, tick: number): PlayState {
  let at = state;
  while (at.tick < tick && !at.ended) at = tickOnce(at);
  return at.tick < tick ? { ...at, tick } : at;
}

// Savage Vision, a gift of the tree: on for a while, then resting.
export function vision(state: PlayState): Stepped<PlayState> {
  if (!state.touchedTree) return refuse("the tree has not given vision yet");
  if (state.moment !== null) return refuse("a moment is going");
  if (state.tick < state.visionReady) return refuse("vision is resting");
  const until = state.tick + visionTicks(state);
  const opened = {
    ...state,
    visionReady: until + visionRestTicks,
    visionUntil: until,
    visionUses: state.visionUses + 1,
  };
  return { ok: true, state: withNews(seeHidden(opened), "vision") };
}

// Whether the lead runs when they walk: 1 to run, 0 to walk.
export function hurry(state: PlayState, fast: number): Stepped<PlayState> {
  if (fast !== 0 && fast !== 1) return refuse("fast is 0 or 1");
  return { ok: true, state: { ...state, hurrying: fast === 1 } };
}

// The way the lead walks (one of sixteen), or -1 to stand still. Not in the middle of a moment.
export function move(state: PlayState, way: number): Stepped<PlayState> {
  if (state.moment !== null)
    return refuse("the lead cannot walk off in a moment");
  if (!Number.isInteger(way) || way < -1 || way > 15)
    return refuse("a way is -1 or 0 to 15");
  return {
    ok: true,
    state: { ...state, facing: way >= 0 ? way : state.facing, moving: way },
  };
}
