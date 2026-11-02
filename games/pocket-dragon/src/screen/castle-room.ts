import { block } from "@ador/game-sdk/pixels";

import {
  roomHeight,
  rooms,
  roomTile,
  roomWidth,
} from "../rules/castle/rooms.ts";
import type { CastleState, Spot } from "../rules/castle/types.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// Inside a house, seen from above and in the middle of the screen: wooden floor and walls, the furniture, the chest (open once its gear
// is taken) and the clue's stand (glowing until read), the door out, and the room's name.
const width = 256;
const height = 144;
export const roomNames = [
  "THE BAKERY",
  "THE LIBRARY",
  "THE WATCHTOWER",
] as const;

// Where the room's top left is on the screen, as a camera that is off the edge of the room.
export const roomCamera: Spot = {
  x: -Math.round((width - roomWidth * 16) / 2),
  y: -Math.round((height - roomHeight * 16) / 2) - 6,
};

function furniture(
  context: CanvasRenderingContext2D,
  tile: string,
  x: number,
  y: number,
  state: CastleState,
): void {
  const room = rooms[state.room];
  switch (tile) {
    case "O":
      block(context, "#8a3b2b", x, y, 16, 16);
      block(context, colour.fire, x + 4, y + 8, 8, 5);
      block(context, colour.fireHot, x + 6, y + 10, 4, 2);
      return;
    case "K":
      block(context, colour.woodDark, x, y, 16, 16);
      for (let book = 0; book < 4; book += 1)
        block(
          context,
          [colour.berry, colour.cyan, colour.gold, colour.mint][book] ??
            colour.pink,
          x + 2 + book * 3,
          y + 3,
          2,
          10,
        );
      return;
    case "T":
      block(context, colour.wood, x + 1, y + 3, 14, 10);
      block(context, colour.woodDark, x + 1, y + 12, 14, 2);
      return;
    case "Y":
      block(context, colour.stone, x + 6, y + 8, 4, 8);
      block(context, colour.gold, x + 3, y + 2, 10, 5);
      return;
    case "C": {
      const open = room !== undefined && state.gear[room.gear] === true;
      block(context, colour.woodDark, x + 2, y + 5, 12, 9);
      block(
        context,
        open ? colour.ink : colour.wood,
        x + 3,
        y + (open ? 3 : 6),
        10,
        open ? 3 : 4,
      );
      block(context, colour.gold, x + 7, y + 8, 2, 3);
      return;
    }
    case "S": {
      const read = room !== undefined && state.clues[room.clue] === true;
      block(context, colour.woodDark, x + 7, y + 8, 2, 8);
      block(context, colour.cream, x + 3, y + 3, 10, 6);
      if (!read && Math.floor(state.tick / 12) % 2 === 0)
        block(context, colour.gold, x + 2, y + 2, 12, 1);
      return;
    }
    case "D":
      block(context, "#fff2b8", x + 3, y, 10, 16);
      return;
    default:
      block(context, "#4a2f3a", x, y, 16, 16);
      block(context, "#6b4452", x + 1, y + 1, 14, 6);
  }
}

export function drawRoom(
  context: CanvasRenderingContext2D,
  state: CastleState,
): void {
  block(context, colour.deep, 0, 0, width, height);
  for (let ty = 0; ty < roomHeight; ty += 1)
    for (let tx = 0; tx < roomWidth; tx += 1) {
      const x = tx * 16 - roomCamera.x;
      const y = ty * 16 - roomCamera.y;
      block(context, (tx + ty) % 2 === 0 ? "#c98a54" : "#b97a46", x, y, 16, 16);
      block(context, colour.woodDark, x, y + 15, 16, 1);
      const tile = roomTile(state.room, tx, ty);
      if (tile !== "w") furniture(context, tile, x, y, state);
    }
  write(
    context,
    roomNames[state.room] ?? "",
    width - 4,
    2,
    8,
    colour.gold,
    "right",
  );
}
