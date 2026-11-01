import { touching } from "./collide.ts";
import {
  doorSize,
  forceTicks,
  groundRow,
  heroHeight,
  heroWidth,
  levelTiles,
  pickupSize,
  rollerSize,
  rollerSpeed,
  rows,
  secretTiles,
  skyStart,
  springHeight,
  springSpeed,
  springWidth,
  stompDepth,
  tile,
  tunnelStart,
  ventEvery,
  ventHeight,
  ventOn,
  ventWidth,
  wingTicks,
} from "./constants.ts";
import { startHero } from "./state.ts";
import type {
  Hero,
  HillsLevel,
  HillsState,
  Roller,
  Spot,
  Vent,
} from "./types.ts";

// The secret areas, the power-ups and the new obstacles of Egg Hills, as the rules see them.

export type Section = "main" | "sky" | "tunnel";

export const sectionOf = (x: number): Section =>
  x < levelTiles * tile ? "main" : x < skyStart * tile ? "tunnel" : "sky";

// The first and last column (exclusive) of a section, for the camera.
export const sectionSpan = (section: Section): readonly [number, number] =>
  section === "main"
    ? [0, levelTiles]
    : section === "tunnel"
      ? [tunnelStart, tunnelStart + secretTiles]
      : [skyStart, skyStart + secretTiles];

// A vent is puffing; a boulder is here (it rolls to and fro on its stretch, the same for every tick of the run).
export const ventOnAt = (vent: Vent, tick: number): boolean =>
  (tick + vent.phase) % ventEvery < ventOn;

export function rollerX(roller: Roller, tick: number): number {
  const span = roller.maxX - roller.minX;
  const gone = (tick * rollerSpeed + roller.phase) % (2 * span);
  return roller.minX + (gone <= span ? gone : 2 * span - gone);
}

const touches = (hero: Hero, spot: Spot, width: number, height: number) =>
  touching(
    hero.x,
    hero.y,
    heroWidth,
    heroHeight,
    spot.x,
    spot.y,
    width,
    height,
  );

// Glitchy standing on the ground of `row` at `x`.
const standingAt = (x: number, row: number): Hero => ({
  ...startHero(),
  x,
  y: row * tile - heroHeight,
});

// Each secret area counts once a stage.
function found(state: HillsState, area: "sky" | "tunnel"): HillsState {
  const known = area === "sky" ? state.skyFound : state.tunnelFound;
  return {
    ...state,
    secretsFound: state.secretsFound + (known ? 0 : 1),
    skyFound: state.skyFound || area === "sky",
    tunnelFound: state.tunnelFound || area === "tunnel",
  };
}

// Down pressed while standing on the burrow digs Glitchy into the tunnel.
export function dig(state: HillsState): HillsState {
  const { burrow } = state.level;
  const { hero } = state;
  const middle = hero.x + heroWidth / 2;
  if (
    !hero.grounded ||
    middle < burrow.x ||
    middle >= burrow.x + tile ||
    hero.y + heroHeight !== burrow.y
  )
    return state;
  return found(
    {
      ...state,
      fireballs: [],
      hero: standingAt((tunnelStart + 1) * tile, groundRow),
    },
    "tunnel",
  );
}

// The doors: the swirl cloud up into the sky; the tunnel's pipe up to the nest (which counts as reached); and the sky's rainbow down
// past the swirl cloud. A dragon who falls off a cloud floats down there too, and is not hurt.
export function doors(state: HillsState): HillsState {
  const { hero, level } = state;
  const section = sectionOf(hero.x);
  const door = (spot: Spot): boolean => touches(hero, spot, doorSize, doorSize);
  if (section === "main" && door(level.cloudGate))
    return found(
      { ...state, fireballs: [], hero: standingAt((skyStart + 1) * tile, 6) },
      "sky",
    );
  if (section === "tunnel" && door(level.tunnelEnd))
    return {
      ...state,
      checkpoint: true,
      fireballs: [],
      hero: standingAt(level.tunnelExit, groundRow),
    };
  if (section === "sky" && (door(level.skyEnd) || hero.y > rows * tile))
    return {
      ...state,
      fireballs: [],
      hero: standingAt(level.skyExit, groundRow),
    };
  return state;
}

// The stage's wings and forcefield bubble, taken by touching them.
export function pickUp(state: HillsState): HillsState {
  const { hero, level } = state;
  const wings =
    !state.wingsTaken && touches(hero, level.wings, pickupSize, pickupSize);
  const force =
    !state.forceTaken &&
    touches(hero, level.forcefield, pickupSize, pickupSize);
  return wings || force
    ? {
        ...state,
        forceTaken: state.forceTaken || force,
        forcefield: force ? forceTicks : state.forcefield,
        wings: wings ? wingTicks : state.wings,
        wingsTaken: state.wingsTaken || wings,
      }
    : state;
}

// Standing on a spring mushroom throws Glitchy high, however jump is held.
export const sprung = (level: HillsLevel, hero: Hero): Hero =>
  hero.grounded &&
  level.springs.some((spring) =>
    touches(hero, spring, springWidth, springHeight),
  )
    ? { ...hero, grounded: false, sprung: true, vy: -springSpeed }
    : hero;

// What the new obstacles do this tick: a puffing vent's steam hurts; a boulder's side hurts, but coming down on top of it bounces.
export function obstacles(
  level: HillsLevel,
  hero: Hero,
  tick: number,
  falling: number,
  bottom: number,
): { readonly bounced: boolean; readonly hurt: boolean } {
  const steamed = level.vents.some(
    (vent) =>
      ventOnAt(vent, tick) &&
      touches(
        hero,
        { x: vent.x, y: vent.y - ventHeight },
        ventWidth,
        ventHeight,
      ),
  );
  let bounced = false;
  let hurt = steamed;
  for (const roller of level.rollers) {
    const spot = { x: rollerX(roller, tick), y: roller.y };
    if (!touches(hero, spot, rollerSize, rollerSize)) continue;
    if (falling > 0 && bottom <= roller.y + stompDepth) bounced = true;
    else hurt = true;
  }
  return { bounced, hurt };
}
