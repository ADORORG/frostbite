import { challenge } from "./battle.ts";
import { fireEvery } from "./constants.ts";
import { tileAt } from "./map.ts";
import { gather, openCage, scare } from "./night.ts";
import {
  bloom,
  bolt,
  boulders,
  brambles,
  cage,
  charmSpots,
  doors,
  foes,
  friends,
  gate,
  ice,
  items,
  riverRow,
  splash,
  throne,
  wallRow,
} from "./places.ts";
import { enterRoom, interactRoom, roomTile } from "./rooms.ts";
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

// Where Glitchy can walk: the floor of the room it is in; outdoors, the land (`land`) where no guard stands.
export const walkable = (state: CastleState, x: number, y: number): boolean =>
  state.room >= 0
    ? roomTile(state.room, x, y) === "w"
    : land(state, x, y) &&
      !state.guards.some((guard) => guard.x === x && guard.y === y);

// The land as it is now: friends and keepers stand in the way until they join or cheer up; the river is frozen in winter; the gate,
// the boulders, the brambles and the ice give way once dealt with; the guards' cage is in the way at night.
export function land(state: CastleState, x: number, y: number): boolean {
  if (state.phase === "night" && x === cage.x && y === cage.y) return false;
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
      return state.lilies || state.phase === "winter";
    case "~":
      return state.phase === "winter";
    case "G":
      return state.gateOpen;
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
  if (state.room >= 0) return interactRoom(state, x, y);
  const door = at(doors, x, y);
  if (door >= 0) return enterRoom(state, door);
  if (x === gate.x && y === gate.y && !state.gateOpen)
    return state.phase !== "winter"
      ? say(state, "gate-shut")
      : state.clues.every(Boolean)
        ? say({ ...state, gateOpen: true }, "gate-open")
        : say(state, "gate-clues");
  if (state.phase === "night" && x === cage.x && y === cage.y)
    return openCage(state);
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

// A breath of fire at the tile ahead (one every `fireEvery` ticks): outdoors it melts the ice around Bloom's seeds, and at night it
// leaves the guards it reaches dizzy.
export function breathe(state: CastleState): CastleState {
  if (state.fireTick >= 0 && state.tick - state.fireTick < fireEvery)
    return state;
  const way = ahead[state.facing];
  const fired = { ...state, fireTick: state.tick };
  if (state.room >= 0) return fired;
  const melted =
    state.x + way.x === ice.x && state.y + way.y === ice.y && !state.melted
      ? say({ ...fired, melted: true }, "melted")
      : fired;
  return state.phase === "night"
    ? scare(melted, way, (x, y) => land(melted, x, y))
    : melted;
}

// Arriving on a tile outdoors: an item there is picked up, the river and the bramble wall are passed, at night an egg is saved, and the
// Legendary Golden Egg is taken from the throne once the castle's keepers have all cheered up.
export function arrive(before: CastleState): CastleState {
  if (before.room >= 0) return before;
  const state = before.phase === "night" ? gather(before) : before;
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
    state.x === throne.x &&
    state.y === throne.y &&
    state.cheered.every(Boolean)
  )
    return say(
      { ...passed, finishTick: state.tick, goldenEgg: true },
      "captured",
    );
  return passed;
}
