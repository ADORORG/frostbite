import {
  type HeroId,
  heroIds,
  zoneIds,
  type ZoneId,
} from "../rules/constants.ts";
import { greyAt, greyHomes } from "../rules/greys.ts";
import { familySpots, places, snakeCoil, walls } from "../rules/layout.ts";
import { family } from "../rules/state.ts";
import type { PlayState } from "../rules/types.ts";

// The flat map, for a device with no WebGL 2: the house and the meadow from above, north at the top, each room painted from grey to its
// own colour as the rules give it back; the ancestor tree, the family (the lead brightest), and the sly snakes once seen. It is drawn on
// the screen's own canvas, 640 by 360, and the page's overlays sit on it just as they sit on the three-dimensional view.
export const mapWidth = 640;
export const mapHeight = 360;
const scale = 8;
const west = -26;
const north = -30;

export const toMap = (x: number, z: number): { x: number; y: number } => ({
  x: (x / 1000 - west) * scale + (mapWidth - 52 * scale) / 2,
  y: (z / 1000 - north) * scale,
});

interface Room {
  readonly paint: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly zone: ZoneId;
}

const rooms: readonly Room[] = [
  {
    paint: "#4f8f45",
    x0: -26_000,
    x1: 26_000,
    z0: -30_000,
    z1: 0,
    zone: "meadow",
  },
  { paint: "#c9a46a", x0: -3_000, x1: 3_000, z0: 0, z1: 14_000, zone: "hall" },
  {
    paint: "#2f8c85",
    x0: -12_000,
    x1: -3_000,
    z0: 0,
    z1: 7_000,
    zone: "kitchen",
  },
  {
    paint: "#6a4f9e",
    x0: -12_000,
    x1: -3_000,
    z0: 7_000,
    z1: 14_000,
    zone: "kids",
  },
  { paint: "#8a5a32", x0: 3_000, x1: 12_000, z0: 0, z1: 7_000, zone: "office" },
  {
    paint: "#9a4f63",
    x0: 3_000,
    x1: 12_000,
    z0: 7_000,
    z1: 14_000,
    zone: "parents",
  },
];

const heroPaint: Readonly<Record<HeroId, string>> = {
  ali: "#f0a050",
  heerah: "#4fd6c8",
  kai: "#5fa8ff",
  zora: "#ff7ad0",
};

// A colour from grey (0) to its own (100), as `#rrggbb`.
export function shade(paint: string, colour: number): string {
  const grey = [0x77, 0x74, 0x8a];
  const share = Math.max(0, Math.min(1, colour / 100));
  const own = [1, 3, 5].map((at) => parseInt(paint.slice(at, at + 2), 16));
  return `#${own
    .map((value, at) =>
      Math.round((grey[at] ?? 0) + (value - (grey[at] ?? 0)) * share)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function dot(
  context: CanvasRenderingContext2D,
  x: number,
  z: number,
  radius: number,
  paint: string,
): void {
  const at = toMap(x, z);
  context.fillStyle = paint;
  context.beginPath();
  context.arc(at.x, at.y, radius, 0, Math.PI * 2);
  context.fill();
}

export function drawMap(
  context: CanvasRenderingContext2D,
  state: PlayState,
  select: HeroId,
  time: number,
): void {
  context.fillStyle = "#120b2e";
  context.fillRect(0, 0, mapWidth, mapHeight);
  for (const room of rooms) {
    const from = toMap(room.x0, room.z0);
    const to = toMap(room.x1, room.z1);
    context.fillStyle = shade(
      room.paint,
      state.colour[zoneIds.indexOf(room.zone)] ?? 0,
    );
    context.fillRect(from.x, from.y, to.x - from.x, to.y - from.y);
  }
  context.fillStyle = "#2a1d4f";
  for (const wall of walls) {
    if (snakeCoil.includes(wall)) continue;
    const from = toMap(wall.x0, wall.z0);
    const to = toMap(wall.x1, wall.z1);
    context.fillRect(
      from.x,
      from.y,
      Math.max(1, to.x - from.x),
      Math.max(1, to.y - from.y),
    );
  }
  // The tree: silver, warming to gold as the house does.
  const lit =
    state.cause === "lit" ? 100 : (state.colour[zoneIds.indexOf("hall")] ?? 0);
  dot(context, 0, 6_000, 10, shade("#ffc74a", lit));
  // The giant snake asleep round the hilltop, until the tree is lit.
  dot(context, places.hill.x, places.hill.z, 6, "#ffffff33");
  if (state.cause !== "lit") {
    const hill = toMap(places.hill.x, places.hill.z);
    context.strokeStyle = "#a9a7bf";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(hill.x, hill.y, 3.6 * scale, 0, Math.PI * 2);
    context.stroke();
  }
  state.greys.forEach((grey, index) => {
    const home = greyHomes[index];
    if (home === undefined || !grey.seen || grey.healed) return;
    const at = greyAt(home, grey.spot, grey.phase, state.tick);
    dot(context, at.x, at.z, 4, "#b9bdc9");
  });
  const together = state.lead === null ? [] : family(state);
  for (const hero of heroIds) {
    if (together.includes(hero)) continue;
    const spot = familySpots[hero];
    const chosen = state.lead === null && hero === select;
    dot(
      context,
      spot.x,
      spot.z,
      chosen ? 7 + Math.sin(time * 4) : 5,
      heroPaint[hero],
    );
  }
  if (state.lead === null) return;
  dot(context, state.x, state.z, 8, "#fff3c4");
  dot(context, state.x, state.z, 6, heroPaint[state.lead]);
}
