import {
  banner,
  bloom,
  bolt,
  boulders,
  brambles,
  charmSpots,
  foes,
  friends,
  ice,
  items,
  riverRow,
  splash,
  wallRow,
} from "./places.ts";
import { challenge } from "./battle.ts";
import { tileAt } from "./map.ts";
import type { CastleState, Facing, Spot } from "./types.ts";

// The land and what the guild can do in it: where Glitchy can walk, and what happens on bumping into (or talking to) what stands in
// the way.
export const ahead: Readonly<Record<Facing, Spot>> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

const at = (list: readonly Spot[], x: number, y: number): number =>
  list.findIndex((spot) => spot.x === x && spot.y === y);

export const say = (state: CastleState, id: string): CastleState => ({
  ...state,
  message: { id, tick: state.tick },
});

export function walkable(state: CastleState, x: number, y: number): boolean {
  const friend = at(friends, x, y);
  if (friend >= 0 && state.friends[friend] !== true) return false;
  const foe = at(foes, x, y);
  if (foe >= 0 && state.cheered[foe] !== true) return false;
  switch (tileAt(x, y)) {
    case ".":
    case ",":
    case "f":
    case "s":
    case "c":
      return true;
    case "L":
      return state.lilies;
    case "o":
      return state.pushed[at(boulders, x, y)] === true;
    case "#":
      return state.opened[at(brambles, x, y)] === true;
    case "I":
      return state.melted;
    default:
      return false;
  }
}

// What bumping into a tile (or talking to it) does.
export function interact(
  state: CastleState,
  x: number,
  y: number,
): CastleState {
  const friend = at(friends, x, y);
  if (friend >= 0 && state.friends[friend] !== true)
    return state.held[friend] === true
      ? say(
          {
            ...state,
            friends: state.friends.map(
              (joined, index) => joined || index === friend,
            ),
            held: state.held.map((has, index) => has && index !== friend),
          },
          `joined-${String(friend)}`,
        )
      : say(state, `wants-${String(friend)}`);
  const foe = at(foes, x, y);
  if (foe >= 0 && state.cheered[foe] !== true) return challenge(state, foe);
  const tile = tileAt(x, y);
  if (tile === "o" && !walkable(state, x, y))
    return state.friends[bolt] === true
      ? say(
          {
            ...state,
            pushed: state.pushed.map(
              (done, index) => done || index === at(boulders, x, y),
            ),
          },
          "pushed",
        )
      : say(state, "boulder");
  if (tile === "L" && !state.lilies)
    return state.friends[splash] === true
      ? say({ ...state, lilies: true }, "lilies")
      : say(state, "river");
  if (tile === "#" && !walkable(state, x, y))
    return state.friends[bloom] === true
      ? say(
          {
            ...state,
            opened: state.opened.map(
              (done, index) => done || index === at(brambles, x, y),
            ),
          },
          "parted",
        )
      : say(state, "bramble");
  if (tile === "I" && !state.melted) return say(state, "ice");
  return state;
}

// A breath of fire at the tile ahead: it melts the ice around Bloom's seeds.
export function breathe(state: CastleState): CastleState {
  const { x, y } = ahead[state.facing];
  const fired = { ...state, fireTick: state.tick };
  return state.x + x === ice.x && state.y + y === ice.y && !state.melted
    ? say({ ...fired, melted: true }, "melted")
    : fired;
}

// Arriving on a tile: an item there is picked up, the river and the bramble wall are passed, and the banner goes up once the castle's
// keepers have all cheered up.
export function arrive(state: CastleState): CastleState {
  const item = at(items, state.x, state.y);
  const passed = {
    ...state,
    crossedRiver: state.crossedRiver || state.y < riverRow,
    escapedWoods: state.escapedWoods || state.y < wallRow,
  };
  if (item >= 0 && state.taken[item] !== true)
    return say(
      {
        ...passed,
        held: passed.held.map((has, index) => has || index === item),
        taken: passed.taken.map((done, index) => done || index === item),
      },
      `got-${String(item)}`,
    );
  const charm = at(charmSpots, state.x, state.y);
  if (charm >= 0 && state.charms[charm] !== true)
    return say(
      {
        ...passed,
        charms: passed.charms.map((found, index) => found || index === charm),
      },
      `found-charm-${String(charm)}`,
    );
  if (
    state.x === banner.x &&
    state.y === banner.y &&
    state.cheered.every(Boolean)
  )
    return say(
      { ...passed, bannerRaised: true, finishTick: state.tick },
      "captured",
    );
  return passed;
}
