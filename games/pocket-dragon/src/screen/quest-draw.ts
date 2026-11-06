import { block, sprite } from "@frostbite/game-sdk/pixels";

import { chapterTitles } from "../chapters.ts";
import { chapterIds, type ChapterId } from "../rules/constants.ts";
import { shiftTicks } from "../rules/quest/constants.ts";
import { legHearts, legShown, legTick, onLeg } from "../rules/quest/legs.ts";
import type { QuestState } from "../rules/quest/types.ts";
import { clockOf } from "../score.ts";
import { big } from "./castle-battle.ts";
import { drawCastle } from "./castle-draw.ts";
import { drawHills } from "./hills-draw.ts";
import { colour } from "./palette.ts";
import { glitchyColours, glitchySide } from "./sprites.ts";
import { write } from "./text.ts";
import { drawWoods } from "./woods-screen.ts";

// The whole quest on the screen: the level being played, drawn as it is when played alone, with the quest's clock and hearts over it;
// between two levels, the shift into the next dimension; and how the quest ended.
const width = 256;
const height = 144;
// The new level fades in from white over this many ticks. A ring of the shift is drawn as this many dots.
export const arrivalTicks = 30;
const ringDots = 56;

const heart = [".r.r.", "rrrrr", ".rrr.", "..r.."] as const;
const heartKey = { r: colour.berry };

const rainbow = [
  colour.berry,
  colour.fire,
  colour.gold,
  colour.mint,
  colour.cyan,
  colour.lavender,
  colour.pink,
] as const;

const arrivals: Readonly<Record<ChapterId, readonly [string, string]>> = {
  castle: ["A NEW DIMENSION!", "NOW WALK ANYWHERE ON THE MAP"],
  hills: ["", ""],
  woods: ["INTO THE THIRD DIMENSION!", "SEE THE WOODS THROUGH GLITCHY'S EYES"],
};

// The clock and the hearts, in a small dark pill at the top of the screen.
function drawClock(context: CanvasRenderingContext2D, state: QuestState): void {
  const hearts = legHearts(state.leg);
  const text = clockOf(state.finishTick ?? state.tick);
  const pillWidth = 30 + hearts * 6;
  const left = Math.round((width - pillWidth) / 2);
  context.fillStyle = "rgb(12 6 32 / 0.72)";
  context.fillRect(left, 1, pillWidth, 10);
  for (let at = 0; at < hearts; at += 1)
    sprite(context, heart, heartKey, left + 3 + at * 6, 4);
  write(context, text, left + pillWidth - 3, 2, 8, colour.gold, "right");
}

// The shift between levels: the old world swirls away into rings and stars, Glitchy tumbles through, and the new level's name comes up.
function drawShift(
  context: CanvasRenderingContext2D,
  left: number,
  to: ChapterId,
  tick: number,
): void {
  const done = 1 - left / shiftTicks;
  const cover = Math.min(1, done / 0.3);
  context.fillStyle = `rgb(12 6 32 / ${String(cover)})`;
  context.fillRect(0, 0, width, height);
  rainbow.forEach((fill, ring) => {
    const radius = (done * 320 + ring * 22) % 154;
    context.globalAlpha = cover * (1 - radius / 160);
    for (let dot = 0; dot < ringDots; dot += 1) {
      const angle = (dot / ringDots) * Math.PI * 2;
      block(
        context,
        fill,
        width / 2 + Math.cos(angle) * radius - 1,
        height / 2 + Math.sin(angle) * radius * 0.6 - 1,
        2,
        2,
      );
    }
  });
  context.globalAlpha = cover;
  let seed = 7;
  for (let star = 0; star < 36; star += 1) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    const angle = (seed % 6_283) / 1_000;
    const reach = ((seed >> 8) % 140) + done * 160;
    const far = reach % 150;
    block(
      context,
      rainbow[star % rainbow.length] ?? colour.white,
      width / 2 + Math.cos(angle) * far,
      height / 2 + Math.sin(angle) * far * 0.6,
      far > 60 ? 2 : 1,
      1,
    );
  }
  context.globalAlpha = 1;
  const bob = Math.round(Math.sin(tick / 6) * 3);
  big(context, glitchySide.jump, glitchyColours, 112, 40 + bob, 2);
  const [title, line] = arrivals[to];
  if (done > 0.25) {
    write(context, title, width / 2, 82, 13, colour.gold);
    write(
      context,
      `LEVEL ${String(chapterIds.indexOf(to) + 1)}: ${chapterTitles[to].toUpperCase()}`,
      width / 2,
      100,
      8,
      colour.cyan,
    );
    write(context, line, width / 2, 112, 7, colour.white);
  }
  if (done > 0.85) {
    context.fillStyle = `rgb(255 255 255 / ${String((done - 0.85) / 0.15)})`;
    context.fillRect(0, 0, width, height);
  }
}

// How the quest ended, in a band low on the screen (the level's own words stay above it).
function drawBanner(
  context: CanvasRenderingContext2D,
  title: string,
  line: string,
  fill: string,
): void {
  context.fillStyle = "rgb(12 6 32 / 0.78)";
  context.fillRect(0, 100, width, 34);
  write(context, title, width / 2, 103, 14, fill);
  write(context, line, width / 2, 121, 8, colour.white);
}

export function drawQuest(
  context: CanvasRenderingContext2D,
  state: QuestState,
  layered = false,
  test = false,
): void {
  onLeg(legShown(state.leg), {
    castle: (level) => drawCastle(context, level),
    hills: (level) => drawHills(context, level),
    woods: (level) => drawWoods(context, level, layered, test),
  });
  // In test mode there is no clock (the page marks the screen instead).
  if (!test) drawClock(context, state);
  const since = legTick(state.leg);
  if (state.shift !== null)
    drawShift(context, state.shift.left, state.shift.to, state.tick);
  else if (state.past.length > 0 && since < arrivalTicks) {
    context.fillStyle = `rgb(255 255 255 / ${String(1 - since / arrivalTicks)})`;
    context.fillRect(0, 0, width, height);
  }
  if (state.finishTick !== null)
    drawBanner(
      context,
      "QUEST COMPLETE!",
      test
        ? "A TEST RUN: NOTHING WAS COUNTED"
        : `THE DRAGONS ARE SAFE  TIME ${clockOf(state.finishTick)}`,
      colour.gold,
    );
  else if (state.lost)
    drawBanner(context, "THE QUEST IS OVER", "TRY AGAIN!", colour.blush);
}
