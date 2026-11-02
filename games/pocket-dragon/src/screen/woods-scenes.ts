import { block, sprite } from "@ador/game-sdk/pixels";

import type { Spot } from "../rules/grid.ts";
import { defu } from "../rules/woods/base-map.ts";
import { sceneTicks } from "../rules/woods/scenes.ts";
import type { Base, SceneId, WoodsState } from "../rules/woods/types.ts";
import { defuKey, defuRows } from "./defu.ts";
import { colour } from "./palette.ts";
import { sparkyKey, sparkyRows } from "./sparky-look.ts";
import { glitchyColours, glitchyFront } from "./sprites.ts";
import { lines, write } from "./text.ts";
import { cameraOn, drawBase, glitchyOnBase } from "./woods-base.ts";
import { middleOf, tileSize } from "./woods-base-tiles.ts";

// The scenes of the woods (`rules/woods/scenes.ts` says when they play): black bars close in from the top and bottom, and who speaks
// says their lines one after another in the lower bar. Drawn flat, each has its own picture: the woods seen from above as the camera
// rises out of the maze, the camera moving up to DeFu at her lair, fireworks over the defused rocket, and the rocket leaving for space.
// In three dimensions the picture is the three-dimensional view's, and only the bars and words are drawn here.
type Speaker = "defu" | "glitchy" | "sparky" | null;
interface Line {
  readonly who: Speaker;
  readonly words: string;
}

const scripts: Readonly<Record<SceneId, readonly Line[]>> = {
  lair: [
    { who: "defu", words: "SO, THE LITTLE DRAGON FOUND MY KEYS." },
    {
      who: "defu",
      words:
        "MY FACTORY HATCHES SHADOW DRAGONS, AND MY ROCKET LEAVES IN TWO MINUTES!",
    },
    {
      who: "glitchy",
      words: "NOT IF WE CAN HELP IT! TO THE ROCKET, EVERYONE!",
    },
  ],
  launch: [
    { who: null, words: "TOO LATE... THE ROCKET'S ENGINES ROAR." },
    {
      who: "defu",
      words: "HA! MY EGGS ARE OFF TO SPACE, AND THE WOODS ARE MINE!",
    },
    {
      who: null,
      words: "DEFU WINS THIS TIME. THE DRAGONS NEED YOU TO TRY AGAIN!",
    },
  ],
  peace: [
    { who: null, words: "THE THIRD KEY TURNS, AND THE ROCKET GOES QUIET." },
    {
      who: "defu",
      words: "NO! MY BEAUTIFUL ROCKET! THIS ISN'T OVER, LITTLE DRAGON!",
    },
    {
      who: "glitchy",
      words: "THE EGGS ARE SAFE, AND PEACE COMES BACK TO THE WOODS!",
    },
  ],
  rise: [
    { who: null, words: "OUT OF THE MAZE, THE TREES OPEN UP..." },
    {
      who: "sparky",
      words:
        "BZZT! HI, GLITCHY, I'M SPARKY! I CAN ZIP INTO NOOKS TOO SMALL FOR A DRAGON. PRESS H!",
    },
    { who: "glitchy", words: "LOOK! DEFU'S OUTPOST, AND DRAGONS IN CAGES!" },
    {
      who: null,
      words: "FREE THE CAGED DRAGONS AND FIND THE THREE ROCKET KEYS.",
    },
  ],
};

export const sceneLines = (id: SceneId): readonly string[] =>
  scripts[id].map((line) => line.words);

const bar = 22;
const names: Readonly<Record<"defu" | "glitchy" | "sparky", string>> = {
  defu: "DEFU",
  glitchy: "GLITCHY",
  sparky: "SPARKY",
};
const nameColours: Readonly<Record<"defu" | "glitchy" | "sparky", string>> = {
  defu: colour.pink,
  glitchy: colour.mint,
  sparky: colour.cyan,
};

// How far into its scene the state is, from 0 to 1.
const into = (state: WoodsState, start: number, id: SceneId): number =>
  Math.min(1, (state.tick - start) / sceneTicks[id]);

function bars(
  context: CanvasRenderingContext2D,
  id: SceneId,
  share: number,
): void {
  const script = scripts[id];
  const closed = Math.min(1, share * 12);
  const tall = Math.round(bar * closed);
  block(context, "#000000", 0, 0, 256, tall);
  block(context, "#000000", 0, 144 - tall, 256, tall);
  if (closed < 1) return;
  write(context, "SPACE OR USE: SKIP", 252, 4, 7, colour.lavender, "right");
  const line =
    script[Math.min(script.length - 1, Math.floor(share * script.length))];
  if (line === undefined) return;
  if (line.who === null) {
    lines(line.words, 58).forEach((text, row) =>
      write(context, text, 8, 126 + row * 7, 7, colour.white, "left"),
    );
    return;
  }
  if (line.who === "defu")
    sprite(context, defuRows.slice(0, 16), defuKey(false), 6, 125);
  else if (line.who === "sparky")
    sprite(context, sparkyRows, sparkyKey, 6, 124);
  else sprite(context, glitchyFront, glitchyColours, 6, 125);
  write(context, names[line.who], 26, 123, 6, nameColours[line.who], "left");
  lines(line.words, 54).forEach((text, row) =>
    write(context, text, 26, 130 + row * 7, 7, colour.white, "left"),
  );
}

const lerp = (from: Spot, to: Spot, share: number): Spot => ({
  x: Math.round(from.x + (to.x - from.x) * share),
  y: Math.round(from.y + (to.y - from.y) * share),
});
const rocket = middleOf("R");
const rocketPoint: Spot = {
  x: (rocket.x - 0.5) * tileSize,
  y: (rocket.y - 0.5) * tileSize,
};

// The rocket leaving: a night sky, the rocket climbing on its flame, and DeFu cheering it on.
function liftOff(context: CanvasRenderingContext2D, share: number): void {
  const sky = context.createLinearGradient(0, 0, 0, 144);
  sky.addColorStop(0, "#05021a");
  sky.addColorStop(1, "#3b1c6a");
  context.fillStyle = sky;
  context.fillRect(0, 0, 256, 144);
  for (let star = 0; star < 30; star += 1)
    block(context, colour.white, (star * 53) % 256, (star * 29) % 110, 1, 1);
  const y = Math.round(96 - share * share * 160);
  block(context, colour.white, 122, y, 12, 26);
  block(context, colour.berry, 122, y + 8, 12, 3);
  block(context, colour.berry, 125, y - 6, 6, 6);
  block(context, colour.berry, 118, y + 20, 4, 8);
  block(context, colour.berry, 134, y + 20, 4, 8);
  block(
    context,
    colour.fire,
    124,
    y + 26,
    8,
    8 + (Math.floor(share * 40) % 3) * 2,
  );
  block(context, colour.fireHot, 126, y + 26, 4, 5);
  block(context, "#2a1840", 0, 124, 256, 20);
  sprite(context, defuRows, defuKey(true), 30, 98);
}

function confetti(context: CanvasRenderingContext2D, tick: number): void {
  const fills = [
    colour.gold,
    colour.mint,
    colour.pink,
    colour.cyan,
    colour.lavender,
  ];
  for (let bit = 0; bit < 40; bit += 1) {
    const x = (bit * 67 + tick * ((bit % 3) + 1)) % 256;
    const y = (bit * 23 + tick * ((bit % 4) + 1)) % 144;
    block(context, fills[bit % fills.length] ?? colour.gold, x, y, 2, 2);
  }
}

export function drawScene(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  base: Base,
  layered: boolean,
): void {
  const { scene } = state;
  if (scene === null) return;
  const share = into(state, scene.start, scene.id);
  if (!layered) {
    if (scene.id === "launch") liftOff(context, share);
    else if (scene.id === "lair") {
      const from = glitchyOnBase(base, state.tick);
      const to = { x: defu.x * tileSize, y: defu.y * tileSize };
      drawBase(
        context,
        state,
        base,
        cameraOn(lerp(from, to, Math.min(1, share * 1.5))),
      );
    } else if (scene.id === "peace") {
      drawBase(context, state, base, cameraOn(rocketPoint));
      confetti(context, state.tick);
    } else {
      drawBase(context, state, base);
      context.globalAlpha = Math.max(0, 1 - share * 3);
      block(context, "#140a33", 0, 0, 256, 144);
      context.globalAlpha = 1;
    }
  }
  bars(context, scene.id, share);
}
