import { doors } from "./places.ts";
import type { CastleState, Spot } from "./types.ts";

// Inside the houses: a room each, seen from above, with a chest of gear and a clue on a stand. X wall, w floor, D the door out, C the
// chest, S the clue, and the furniture (O oven, K shelf, T table, Y telescope) is in the way. Glitchy comes in standing just inside the
// door, which is at the same place in every room.
export interface Room {
  readonly clue: number;
  readonly gear: number;
  readonly rows: readonly string[];
}

export const rooms: readonly Room[] = [
  {
    clue: 0,
    gear: 0,
    rows: [
      "XXXXXXXXXXXX",
      "XOOwwwwwwKKX",
      "XwwwwwwwwwwX",
      "XwwTTwwwwCwX",
      "XwwwwwwwwwwX",
      "XSwwwwwwwwwX",
      "XXXXXDXXXXXX",
    ],
  },
  {
    clue: 1,
    gear: 1,
    rows: [
      "XXXXXXXXXXXX",
      "XKKKKwwKKKKX",
      "XwwwwwwwwwwX",
      "XwTTwwwwTTwX",
      "XwwwwwwwwwSX",
      "XCwwwwwwwwwX",
      "XXXXXDXXXXXX",
    ],
  },
  {
    clue: 2,
    gear: 2,
    rows: [
      "XXXXXXXXXXXX",
      "XwwwwYwwwwwX",
      "XwwwwwwwwwwX",
      "XwKwwwwwwKwX",
      "XwwwwCwwSwwX",
      "XwwwwwwwwwwX",
      "XXXXXDXXXXXX",
    ],
  },
];

export const roomWidth = 12;
export const roomHeight = 7;
export const inside: Spot = { x: 5, y: 5 };

export const roomTile = (room: number, x: number, y: number): string =>
  rooms[room]?.rows[y]?.[x] ?? "X";

const say = (state: CastleState, id: string): CastleState => ({
  ...state,
  message: { id, tick: state.tick },
});

export function enterRoom(state: CastleState, room: number): CastleState {
  return say(
    {
      ...state,
      facing: "up",
      room,
      step: null,
      trail: [],
      x: inside.x,
      y: inside.y,
    },
    `room-${String(room)}`,
  );
}

function leave(state: CastleState): CastleState {
  const door = doors[state.room] ?? inside;
  return {
    ...state,
    facing: "down",
    room: -1,
    step: null,
    trail: [],
    x: door.x,
    y: door.y + 1,
  };
}

// What bumping into (or talking to) a tile of a room does: the chest gives its gear once, the stand shows its clue (and counts it once),
// the door leads out.
export function interactRoom(
  state: CastleState,
  x: number,
  y: number,
): CastleState {
  const room = rooms[state.room];
  if (room === undefined) return state;
  switch (roomTile(state.room, x, y)) {
    case "C":
      return state.gear[room.gear] === true
        ? say(state, "chest-empty")
        : say(
            {
              ...state,
              gear: state.gear.map((has, at) => has || at === room.gear),
            },
            `gear-${String(room.gear)}`,
          );
    case "S":
      return say(
        {
          ...state,
          clues: state.clues.map((read, at) => read || at === room.clue),
        },
        `clue-${String(room.clue)}`,
      );
    case "D":
      return leave(state);
    default:
      return state;
  }
}
