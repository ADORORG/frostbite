import { sortedMotes, type Mote } from "../plasma.ts";
import { mapHeight, mapWidth, tileAt } from "./map.ts";

// Metaplasma over the guild's land: a mote over every tile Glitchy can walk on (and the castle floor), a little off its middle, in
// pixels (sixteen to a tile). The land never changes, so neither do they.
const floor = new Set([".", ",", "f", "s", "c"]);

function motesOf(): readonly Mote[] {
  const motes: Mote[] = [];
  for (let y = 0; y < mapHeight; y += 1)
    for (let x = 0; x < mapWidth; x += 1)
      if (floor.has(tileAt(x, y)))
        motes.push({
          x: x * 16 + 8 + (((x * 7 + y * 13) % 9) - 4),
          y: y * 16 + 8 + (((x * 5 + y * 3) % 7) - 3),
        });
  return sortedMotes(motes);
}

export const castleMotes = motesOf();
