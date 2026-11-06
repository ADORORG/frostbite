import {
  bestLine,
  resultWeight,
  startLineFor,
  type ResultCard,
  type ResultRow,
} from "@frostbite/game-sdk/guide";
import { byInput } from "@frostbite/game-sdk/touch";

import { chapterTitles } from "../chapters.ts";
import { guides } from "../guide.ts";
import type { PlayId } from "../rules/constants.ts";
import { clockOf } from "../score.ts";
import { colour } from "../screen/palette.ts";
import type { PlayRun } from "./runs.ts";

// The card over the screen once a run is over, drawn sharp by the SDK (`view.ts`): how it ended, what it came to, the best, and how to go
// again. A test run and a visit to the Sky Nursery count for nothing, so they say so and have no best.
export interface Ending {
  readonly best: number;
  readonly finished: PlayRun;
  readonly newBest: boolean;
  // What Start plays now: the same again, or the level a cleared one opened.
  readonly next: PlayId;
}

export const testLine = "A TEST RUN: NOTHING WAS COUNTED";

const row = (text: string, fill: string, weight: number): ResultRow => ({
  colour: fill,
  text,
  weight,
});
const heading = (text: string, fill: string): ResultRow =>
  row(text, fill, resultWeight.heading);

function headingOf(finished: PlayRun): ResultRow {
  if (finished.screen === "nursery")
    return heading("THE SKY NURSERY", colour.cyan);
  if (finished.id === "quest")
    return finished.won()
      ? heading("QUEST COMPLETE!", colour.gold)
      : heading("THE QUEST IS OVER", colour.blush);
  const title = chapterTitles[finished.id].toUpperCase();
  return finished.cleared().includes(finished.id)
    ? heading(`${title} CLEARED!`, colour.gold)
    : heading(`${title}: TRY AGAIN!`, colour.blush);
}

// What the run came to: the clock and the score of a won quest, the score of any other, and the counts of a visit that is not scored.
function detailOf(finished: PlayRun): string {
  if (finished.screen === "nursery")
    return finished
      .stats()
      .map(([label, value]) => `${label.toUpperCase()} ${value}`)
      .join("  ");
  if (finished.test) return testLine;
  const score = `SCORE ${finished.score().toLocaleString("en-US")}`;
  const fame = finished.fame();
  return fame === null ? score : `TIME ${clockOf(fame.ticks)}  ${score}`;
}

const againLine = (): string =>
  byInput("ENTER TO PLAY AGAIN", "TAP TO PLAY AGAIN");

export function resultOf({
  best,
  finished,
  newBest,
  next,
}: Ending): ResultCard {
  const counted = !finished.test;
  const prompt =
    counted && next === finished.id
      ? againLine()
      : startLineFor(guides[next].start, guides[next].touchStart);
  return {
    rows: [
      headingOf(finished),
      row(detailOf(finished), colour.white, resultWeight.detail),
      ...(counted
        ? [row(bestLine(best, newBest), colour.mint, resultWeight.line)]
        : []),
      row(prompt, colour.cream, resultWeight.prompt),
    ],
  };
}
