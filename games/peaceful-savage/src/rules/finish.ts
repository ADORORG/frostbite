import {
  heroIds,
  points,
  ticksPerSecond,
  timeBonusSeconds,
  type ZoneId,
  zoneIds,
} from "./constants.ts";
import { isCreation, make } from "./create.ts";
import { zoneAt } from "./geometry.ts";
import {
  mirrorForceCap,
  mirrorLight,
  spark,
  withLight,
  withSpark,
} from "./growth.ts";
import { familySpots } from "./layout.ts";
import { withColour, withNews, withPoints } from "./state.ts";
import type { Moment, PlayState } from "./types.ts";

// Every room at once, by `amount`.
const everywhere = (state: PlayState, amount: number): PlayState =>
  zoneIds.reduce<PlayState>(
    (shown, zone: ZoneId) => withColour(shown, zone, amount),
    state,
  );

// At a mirror, breathed and re-centred: the spark full, a charge of mirror force, and the first time at each mirror some light.
function centred(state: PlayState, mirror: number): PlayState {
  const first = state.mirrorsUsed[mirror] === false;
  const steady = {
    ...state,
    greyed: 0,
    mirrorForce: Math.min(mirrorForceCap, state.mirrorForce + 1),
    mirrorsUsed: state.mirrorsUsed.map((used, at) => used || at === mirror),
    spark: 100,
  };
  return withNews(
    first ? withLight(steady, mirrorLight) : steady,
    "mirror",
    String(mirror),
  );
}

// What a moment brings about once its last step is done.
export function finish(state: PlayState, moment: Moment): PlayState {
  const { kind } = moment;
  if (kind === "forge")
    return withNews(
      withColour(
        withPoints({ ...state, sparky: true }, points.sparky),
        "hall",
        20,
      ),
      "sparky",
    );
  if (kind === "weave")
    return withNews(
      everywhere(withPoints({ ...state, jackets: true }, points.jackets), 20),
      "jackets",
    );
  if (kind === "drawer")
    return withNews(
      withColour(
        withPoints({ ...state, drawer: true }, points.drawer),
        "office",
        20,
      ),
      "drawer",
    );
  if (kind === "mirror") return centred(state, moment.arg);
  if (kind === "build")
    return withNews(
      withColour(
        withPoints({ ...state, tower: true }, points.tower),
        "meadow",
        10,
      ),
      "tower",
    );
  if (kind === "finale") return lit(state);
  if (isCreation(kind)) return make(state, kind);
  const hero = heroIds.find((each) => each === kind);
  if (hero === undefined) return state;
  const joined = withSpark(
    withPoints({ ...state, party: [...state.party, hero] }, points.found),
    spark.found,
  );
  return withNews(
    withColour(joined, zoneAt(familySpots[hero]), 30),
    "found",
    hero,
  );
}

// The giant snake folds gold, the tree lights, and every room takes its colour back. The run is over; time left over is a point a second.
function lit(state: PlayState): PlayState {
  const seconds = Math.floor(state.tick / ticksPerSecond);
  const bonus = Math.max(0, timeBonusSeconds - seconds);
  return withNews(
    withPoints(
      {
        ...state,
        cause: "lit",
        colour: zoneIds.map(() => 100),
        ended: true,
        moving: -1,
      },
      points.lit + bonus,
    ),
    "lit",
  );
}
