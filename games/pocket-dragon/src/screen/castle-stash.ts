import { block, sprite } from "@frostbite/game-sdk/pixels";

import { castleMotes } from "../rules/castle/motes.ts";
import { charmSpots } from "../rules/castle/places.ts";
import { levelAt } from "../rules/castle/constants.ts";
import { cluesRead, eggsSaved, levelOf, xpOf } from "../rules/castle/guild.ts";
import type { CastleState, Spot } from "../rules/castle/types.ts";
import { charmKey, featherIcon, shieldIcon } from "./hills-sky.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// Metaplasma over the guild's land, the secret charms (shown only within two tiles of Glitchy), and in the corners the metaplasma gathered
// and the charms held for challenges, and the guild's level, its experience to the next, its gear, and the clues (or, at night, the eggs).
const starIcon = [
  "....g....",
  "....g....",
  "...ggg...",
  "ggggggggg",
  ".ggggggg.",
  "..ggggg..",
  ".ggg.ggg.",
  ".gg...gg.",
  ".........",
];
const icons = [featherIcon, starIcon, shieldIcon] as const;
const key = { ...charmKey, g: colour.gold };

export function landStash(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  const { taken, drifting } = state.plasma;
  const twinkle = Math.floor(state.tick / 12);
  castleMotes.forEach((mote, at) => {
    if (taken[at] === true) return;
    const x = mote.x - camera.x;
    const y = mote.y - camera.y;
    if (x < -2 || y < -2 || x > 258 || y > 146) return;
    block(
      context,
      (at + twinkle) % 4 === 0
        ? colour.white
        : at % 2 === 0
          ? colour.cyan
          : colour.pink,
      x,
      y,
      1,
      1,
    );
  });
  for (const mote of drifting)
    block(context, colour.white, mote.x - camera.x, mote.y - camera.y, 2, 2);
  charmSpots.forEach((spot, at) => {
    if (state.charms[at] === true) return;
    if (Math.abs(spot.x - state.x) > 2 || Math.abs(spot.y - state.y) > 2)
      return;
    sprite(
      context,
      icons[at] ?? starIcon,
      key,
      spot.x * 16 + 4 - camera.x,
      spot.y * 16 + 3 - camera.y,
    );
    if (Math.floor(state.tick / 6) % 2 === 0)
      block(
        context,
        colour.white,
        spot.x * 16 + 2 - camera.x,
        spot.y * 16 + 2 - camera.y,
        1,
        1,
      );
  });
}

// The gear, as small icons: swift boots, the cheer cape, the ember helm.
const gearIcons = [
  ["..bb...", "..bb...", "..bb...", "..bbbb.", ".bbbbbb", "bbbbbbb"],
  [".bbbbb.", "bbbbbbb", "bbbbbbb", "bb.b.bb", "bb...bb", "b.....b"],
  ["..bbb..", ".bbbbb.", "bbbbbbb", "by.b.yb", "b.....b"],
] as const;
const gearColours = [colour.cyan, colour.pink, colour.fire] as const;

export function landHud(
  context: CanvasRenderingContext2D,
  state: CastleState,
): void {
  write(
    context,
    `PLASMA ${String(state.plasma.gathered)}`,
    4,
    4,
    7,
    colour.cyan,
    "left",
  );
  state.charms.forEach((found, at) => {
    if (found && state.charmsUsed[at] !== true)
      sprite(context, icons[at] ?? starIcon, key, 4 + at * 11, 14);
  });
  const xp = xpOf(state);
  const level = levelOf(xp);
  const from = levelAt[level - 1] ?? 0;
  const to = levelAt[level] ?? from;
  write(context, `GUILD LV ${String(level)}`, 252, 3, 7, colour.gold, "right");
  block(context, colour.ink, 204, 12, 48, 3);
  block(
    context,
    colour.gold,
    205,
    13,
    to > from ? Math.floor((46 * (xp - from)) / (to - from)) : 46,
    1,
  );
  gearIcons.forEach((rows, at) =>
    sprite(
      context,
      rows,
      {
        b:
          state.gear[at] === true
            ? (gearColours[at] ?? colour.white)
            : colour.ink,
        y: colour.fireHot,
      },
      228 + at * 9,
      18,
    ),
  );
  const line =
    state.phase === "night"
      ? `EGGS ${String(eggsSaved(state))}/${String(state.eggs.length)}`
      : `CLUES ${String(cluesRead(state))}/${String(state.clues.length)}`;
  write(context, line, 252, 27, 7, colour.white, "right");
}
