import { block } from "@frostbite/game-sdk/pixels";

import { colour } from "../screen/palette.ts";
import type { Badge, CardContent } from "./content.ts";
import type { Box, Layout } from "./layout.ts";
import { fitted, panel, say, wrap } from "./paint.ts";

// The three chapters on a card picture, each with its number, its name, whether it is cleared, open or locked, and its best score: as
// tiles (side by side or one above another), or as long rows for a tall story.
const edges: Readonly<Record<Badge["state"], string>> = {
  cleared: colour.gold,
  locked: colour.stone,
  open: colour.mint,
};
const states: Readonly<Record<Badge["state"], string>> = {
  cleared: "CLEARED",
  locked: "LOCKED",
  open: "OPEN",
};

function number(
  context: CanvasRenderingContext2D,
  item: Badge,
  x: number,
  y: number,
  size: number,
): void {
  block(context, edges[item.state], x, y, size, size);
  say(
    context,
    String(item.number),
    x + size / 2,
    y + size * 0.14,
    size * 0.72,
    colour.ink,
    "center",
  );
}

// The tiles' sizes: the number, the space round it, and the room left for a name.
function tileSizes(box: Box) {
  const size = Math.min(box.height * 0.2, box.width * 0.13);
  const pad = size * 0.8;
  return { pad, room: box.width - pad * 3 - size * 1.4, size };
}

// The three names are written at one size, the biggest at which each fits its tile in two lines.
function tile(
  context: CanvasRenderingContext2D,
  box: Box,
  item: Badge,
  name: number,
): void {
  panel(
    context,
    box,
    "#2b1a66",
    edges[item.state],
    Math.max(3, box.width / 60),
    Math.max(6, box.width / 30),
  );
  const { pad, room, size } = tileSizes(box);
  number(context, item, box.x + pad, box.y + pad, size * 1.4);
  wrap(item.name, room, name).forEach((line, at) =>
    say(
      context,
      line,
      box.x + pad * 2 + size * 1.4,
      box.y + pad + at * name * 1.15,
      name,
      colour.white,
    ),
  );
  say(
    context,
    states[item.state],
    box.x + pad,
    box.y + box.height - pad - size * 1.5,
    size * 0.8,
    edges[item.state],
  );
  if (item.state !== "locked")
    say(
      context,
      `BEST ${item.best}`,
      box.x + box.width - pad,
      box.y + box.height - pad - size * 0.7,
      size * 0.6,
      colour.cream,
      "right",
    );
}

function row(context: CanvasRenderingContext2D, box: Box, item: Badge): void {
  panel(context, box, "#2b1a66", edges[item.state], 4, 8);
  const square = box.height * 0.62;
  const pad = (box.height - square) / 2;
  number(context, item, box.x + pad + 4, box.y + pad, square);
  const end =
    item.state === "locked"
      ? states.locked
      : `${states[item.state]} · BEST ${item.best}`;
  const right = fitted(end, box.width * 0.42, box.height * 0.36, 1);
  say(
    context,
    end,
    box.x + box.width - pad * 2,
    box.y + (box.height - right) / 2,
    right,
    edges[item.state],
    "right",
  );
  const room = box.width - square - pad * 5 - end.length * right * 0.6;
  const name = fitted(item.name, room, box.height * 0.42, 1);
  say(
    context,
    item.name,
    box.x + square + pad * 3,
    box.y + (box.height - name) / 2,
    name,
    colour.white,
  );
}

export function drawBadges(
  context: CanvasRenderingContext2D,
  layout: Layout,
  card: CardContent,
): void {
  const gap = 12;
  const area = layout.badges;
  const across = layout.stack === "across";
  const width = across ? (area.width - 2 * gap) / 3 : area.width;
  const height = across ? area.height : (area.height - 2 * gap) / 3;
  const { room, size } = tileSizes({ height, width, x: 0, y: 0 });
  const name = Math.min(
    ...card.badges.map((item) => fitted(item.name, room, size * 0.75, 2)),
  );
  card.badges.forEach((item, at) => {
    const box = {
      height,
      width,
      x: area.x + (across ? at * (width + gap) : 0),
      y: area.y + (across ? 0 : at * (height + gap)),
    };
    if (layout.stack === "rows") row(context, box, item);
    else tile(context, box, item, name);
  });
}
