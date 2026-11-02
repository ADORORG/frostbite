import { sprite } from "@ador/game-sdk/pixels";

import { cages, chests, panels, valves } from "../rules/woods/base-map.ts";
import { countdownLeft, laserPhase, waveAt } from "../rules/woods/lair.ts";
import { plasmaLeft } from "../rules/woods/vision.ts";
import type { Base, FoundKind, WoodsState } from "../rules/woods/types.ts";
import { frostHud } from "./frost-look.ts";
import { sparkyHud } from "./sparky-look.ts";
import { colour } from "./palette.ts";
import { write } from "./text.ts";

// What is written over the woods outside the maze, in both pictures (flat and three-dimensional): the hearts, what has been gathered
// (in the woods the dragons freed and the rocket keys, in the lair the factory's valves broken and the keys fitted, and the eggs left
// to launch), the rocket's countdown in the lair, a few words when something is done, and a line low down on what to do next.
const heart = [".r.r.", "rrrrr", ".rrr.", "..r.."] as const;
const heartKey = { r: colour.berry };

export const doneWords: Readonly<Record<FoundKind, string>> = {
  ally: "A DRAGON IS FREE! +1 HEART",
  bubble: "FORCEFIELD!",
  ceiling: "AS HIGH AS GLITCHY CAN FLY HERE",
  charm: "A SECRET CHARM!",
  chest: "TREASURE!",
  clue: "A CLUE STONE WHISPERS...",
  egg: "AN EGG FOR THE LAUNCHER",
  empty: "NO NOOK FOR SPARKY THERE",
  freed: "A SHADOW DRAGON IS SET FREE!",
  frost: "FROST VISION! THE WORLD SLOWS DOWN",
  grounded: "NO ROOM TO LAND HERE",
  heart: "AN EXTRA HEART!",
  home: "A GUARD CHEERS UP AND GOES HOME",
  key: "A ROCKET KEY!",
  lantern: "A LANTERN GLOWS",
  launcher: "THE EGG LAUNCHER IS BUILT!",
  melt: "THE FROZEN HEDGE MELTS",
  moon: "THE MOON CHEST!",
  panel: "A KEY FITS THE ROCKET!",
  part: "A LAUNCHER PART!",
  shielded: "THE FACTORY SHIELDS THE ROCKET!",
  sparky: "SPARKY ZIPS BACK WITH A TREASURE!",
  valve: "A VALVE OF THE FACTORY BURSTS!",
  weary: "FROST VISION IS NOT READY",
};

const count = (list: readonly boolean[]): number => list.filter(Boolean).length;
const of = (label: string, got: number, total: number): string =>
  `${label} ${String(got)}/${String(total)}`;

// What to do next, or what to dodge right now.
export function nextStep(state: WoodsState, base: Base): string {
  if (base.lairStart < 0)
    return count(base.pieces) < chests.length
      ? "FREE THE CAGED DRAGONS, OPEN THE CHESTS FOR 3 ROCKET KEYS"
      : "THE LAIR'S GATE IS OPEN! FOLLOW THE PATH NORTH";
  if (waveAt(base, state.tick) === 0)
    return "SHOCKWAVE! RUN FAR FROM DEFU, OR DOWN TO THE DUNGEON";
  if (laserPhase(base, state.tick) === "glow")
    return "LASER! STEP OFF THE GLOWING LINE";
  return count(base.broken) < valves.length
    ? "BREAK THE FACTORY'S 3 VALVES WITH FIRE TO DROP THE SHIELD"
    : "THE SHIELD IS DOWN! FIT THE KEYS INTO THE ROCKET'S PANELS";
}

const clockOf = (ticks: number): string => {
  const seconds = Math.ceil(ticks / 60);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
};

export function baseHud(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
): void {
  for (let at = 0; at < state.hearts; at += 1)
    sprite(context, heart, heartKey, 247 - at * 7, 4);
  const counts =
    base.lairStart < 0
      ? [
          of("ALLIES", count(base.allies), cages.length),
          of("KEYS", count(base.pieces), chests.length),
        ]
      : [
          of("PANELS", count(base.installed), panels.length),
          of("VALVES", count(base.broken), valves.length),
        ];
  [
    ...counts,
    `EGGS ${String(base.ammo)}  PLASMA ${String(plasmaLeft(state))}`,
  ].forEach((text, at) =>
    write(context, text, 4, 3 + at * 9, 7, colour.cyan, "left"),
  );
  frostHud(context, state, base);
  sparkyHud(context, state, base);
  if (base.lairStart >= 0) {
    const left = countdownLeft(base, state.tick);
    const urgent = left < 1_800 && Math.floor(state.tick / 15) % 2 === 0;
    write(
      context,
      `ROCKET ${clockOf(left)}`,
      128,
      13,
      10,
      urgent ? colour.berry : colour.gold,
    );
  }
  const { found } = state;
  if (found !== null && state.tick - found.tick < 120)
    write(context, doneWords[found.kind], 128, 40, 10, colour.gold);
  context.fillStyle = "rgb(12 6 32 / 0.6)";
  context.fillRect(0, 133, 256, 11);
  write(context, nextStep(state, base), 128, 135, 7, colour.white);
}
