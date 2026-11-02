import { charmSpots, doors, items } from "../../src/rules/castle/places.ts";
import { inside } from "../../src/rules/castle/rooms.ts";
import type {
  CastleState,
  Facing,
  Spot,
} from "../../src/rules/castle/types.ts";

// The steps of the guild's level for a player who knows it: in the day, the friends' wishes, the obstacles their powers clear and the
// three houses (gear and a clue each); in the winter, the gate, the keepers and the throne. The night is played as it comes
// (`castle-bot.ts`). A step is a place to stand (outdoors, or in a house: `room`), a way to face, and a key to press there.
export interface Task {
  readonly done: (state: CastleState) => boolean;
  readonly face: Facing;
  readonly press: "act" | "fire" | null;
  readonly room: number;
  readonly stand: Spot;
}

const fetch = (item: number): Task => ({
  done: (s) => s.taken[item] === true,
  face: "down",
  press: null,
  room: -1,
  stand: items[item] ?? { x: 0, y: 0 },
});
const meet = (
  stand: Spot,
  face: Facing,
  done: (s: CastleState) => boolean,
  press: "act" | "fire" = "act",
  room = -1,
): Task => ({ done, face, press, room, stand });

const charmAt = (charm: number): Task => ({
  done: (s) => s.charms[charm] === true,
  face: "down",
  press: null,
  room: -1,
  stand: charmSpots[charm] ?? { x: 0, y: 0 },
});

// In each house, where to stand to open its chest and read its clue, and which way to face.
const stands: readonly (readonly [Spot, Facing, Spot, Facing])[] = [
  [{ x: 9, y: 4 }, "up", { x: 2, y: 5 }, "left"],
  [{ x: 2, y: 5 }, "left", { x: 10, y: 5 }, "up"],
  [{ x: 5, y: 5 }, "up", { x: 8, y: 5 }, "up"],
];

const house = (room: number): readonly Task[] => {
  const door = doors[room] ?? { x: 0, y: 0 };
  const [chest, toChest, clue, toClue] = stands[room] ?? [];
  const searched = (s: CastleState) =>
    s.gear[room] === true && s.clues[room] === true;
  return [
    meet(
      { x: door.x, y: door.y + 1 },
      "up",
      (s) => s.room === room || searched(s),
    ),
    meet(
      chest ?? inside,
      toChest ?? "up",
      (s) => s.gear[room] === true,
      "act",
      room,
    ),
    meet(
      clue ?? inside,
      toClue ?? "up",
      (s) => s.clues[room] === true,
      "act",
      room,
    ),
    meet(inside, "down", (s) => s.room !== room && searched(s), "act", room),
  ];
};

export const dayAndWinter = (charms = true): readonly Task[] => [
  fetch(0),
  ...(charms ? [charmAt(0)] : []),
  meet({ x: 22, y: 25 }, "up", (s) => s.friends[0] === true),
  ...house(0),
  ...house(1),
  meet({ x: 23, y: 25 }, "up", (s) => s.pushed[0] === true),
  meet({ x: 30, y: 25 }, "right", (s) => s.pushed[1] === true),
  fetch(1),
  ...(charms ? [charmAt(1)] : []),
  meet({ x: 24, y: 23 }, "up", (s) => s.friends[1] === true),
  meet({ x: 23, y: 22 }, "up", (s) => s.lilies),
  ...(charms ? [charmAt(2)] : []),
  meet({ x: 9, y: 17 }, "left", (s) => s.melted, "fire"),
  fetch(2),
  meet({ x: 21, y: 17 }, "up", (s) => s.friends[2] === true),
  meet({ x: 19, y: 15 }, "up", (s) => s.opened[0] === true),
  meet({ x: 4, y: 12 }, "left", (s) => s.opened[1] === true),
  fetch(3),
  ...house(2),
  meet({ x: 34, y: 12 }, "right", (s) => s.friends[3] === true),
  meet({ x: 19, y: 11 }, "up", (s) => s.gateOpen),
  meet({ x: 19, y: 10 }, "up", (s) => s.cheered[0] === true),
  meet({ x: 19, y: 8 }, "up", (s) => s.cheered[1] === true),
  meet({ x: 19, y: 5 }, "up", (s) => s.cheered[2] === true),
  meet({ x: 19, y: 4 }, "up", (s) => s.cheered[3] === true),
  {
    done: (s) => s.goldenEgg,
    face: "up",
    press: null,
    room: -1,
    stand: { x: 19, y: 2 },
  },
];
