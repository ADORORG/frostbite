import { points } from "./constants.ts";
import { light, spark, withLight, withSpark } from "./growth.ts";
import { withColour, withNews, withPoints } from "./state.ts";
import type { PlayState } from "./types.ts";

// Zora's lesson: to love the land, plant it and tend it. With Zora in the family, a bare bed is planted with seeds; it sprouts on its
// own, and once it has (twenty seconds on), tending it (water, and a hand on the leaves) brings it into bloom: colour back in the
// meadow, and a little spark and light for the one who tended it.
export const sproutTicks = 600;
export const bare = 0;
export const planted = 1;
export const bloomed = 2;

// Whether a planted bed has sprouted and can be tended.
export const sprouted = (state: PlayState, bed: number): boolean =>
  state.garden[bed] === planted &&
  state.tick - (state.gardenAt[bed] ?? state.tick) >= sproutTicks;

export function plant(state: PlayState, bed: number): PlayState {
  return withNews(
    withPoints(
      {
        ...state,
        garden: state.garden.map((stage, at) => (at === bed ? planted : stage)),
        gardenAt: state.gardenAt.map((tick, at) =>
          at === bed ? state.tick : tick,
        ),
      },
      points.planted,
    ),
    "planted",
    String(bed),
  );
}

export function tend(state: PlayState, bed: number): PlayState {
  const grown = withSpark(
    withLight(
      {
        ...state,
        garden: state.garden.map((stage, at) => (at === bed ? bloomed : stage)),
      },
      light.bloomed,
    ),
    spark.bloomed,
  );
  return withNews(
    withColour(withPoints(grown, points.bloomed), "meadow", 8),
    "bloomed",
    String(bed),
  );
}
