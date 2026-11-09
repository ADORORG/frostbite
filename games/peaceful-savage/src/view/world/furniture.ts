import { Group } from "three";

import type { PlayState } from "../../rules/types.ts";
import { buildEast } from "./east.ts";
import type { Rooms } from "./rooms.ts";
import { buildWest } from "./west.ts";

// The big furniture of each room, and the story's own objects on it (the two wings are built in their own files): the stove and its
// pancakes, Zora's galaxy bowl, the beds, Kai's crystal tower, Daddy's desk and its locked drawer, the books, Mama's loom with its
// threads, the couch, the Latimer lamp and the deck of cards by the tree.
export interface Furniture {
  readonly group: Group;
  update(state: PlayState, time: number, dt: number): void;
}

export function buildFurniture(rooms: Rooms, lights: boolean): Furniture {
  const group = new Group();
  group.name = "furniture";
  const wings = [buildWest(rooms), buildEast(rooms, lights)];
  for (const wing of wings) group.add(wing.group);
  return {
    group,
    update(state, time, dt) {
      for (const wing of wings) wing.update(state, time, dt);
    },
  };
}
