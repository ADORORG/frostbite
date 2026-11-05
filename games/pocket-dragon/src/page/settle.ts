import { outcomeOf, type LastRun } from "../card/content.ts";
import { chapterTitles } from "../chapters.ts";
import {
  withBest,
  withCleared,
  withFame,
  withPlasma,
  type Progress,
} from "../progress.ts";
import { chapterIds, type ChapterId } from "../rules/constants.ts";
import { clockOf } from "../score.ts";
import type { PlayRun } from "./runs.ts";

// What a finished run changes: the saved progress (the best score, the metaplasma banked, the levels it opened to practise, a won
// quest's place in the Hall of Fame), the card's note of the run, and what the page says of it.
export interface Settled {
  readonly lastRun: LastRun;
  readonly news: string;
  // A level the run opened to practise, or null.
  readonly opened: ChapterId | null;
  readonly progress: Progress;
}

const levelName = (id: ChapterId): string =>
  `Level ${String(chapterIds.indexOf(id) + 1)}`;
// The last level (the tuple is three long, so this is typed as the level itself).
const lastLevel = chapterIds[2];

// One or two sentences: how the run went, and a level it opened.
function newsOf(
  finished: PlayRun,
  opened: ChapterId | null,
  rank: number | null,
): string {
  const open =
    opened === null
      ? []
      : [`${levelName(opened)} is open to practise: ${chapterTitles[opened]}!`];
  const fame = finished.fame();
  const said =
    fame !== null
      ? [
          `You won the whole quest in ${clockOf(fame.ticks)}!`,
          ...(rank === null ? [] : [`Hall of Fame: number ${String(rank)}!`]),
        ]
      : finished.id === "quest"
        ? [`The quest ended in ${chapterTitles[finished.level()]}.`]
        : finished.cleared().includes(lastLevel)
          ? [
              "You cleared the last level! Now try the whole quest against the clock.",
            ]
          : [
              `${chapterTitles[finished.level()]}: ${finished.score().toLocaleString("en-US")} points.`,
            ];
  return [...said, ...open].join(" ");
}

export function settle(before: Progress, finished: PlayRun): Settled {
  const cleared = finished.cleared();
  let progress = withPlasma(
    withBest(before, finished.id, finished.score()),
    finished.plasma(),
  );
  for (const id of cleared) progress = withCleared(progress, id);
  const opened =
    progress.unlocked > before.unlocked
      ? (chapterIds[progress.unlocked - 1] ?? null)
      : null;
  const fame = finished.fame();
  const placed = fame === null ? null : withFame(progress, fame);
  const rank = placed?.rank ?? null;
  return {
    lastRun: {
      ...(rank === null ? {} : { rank }),
      chapter: finished.level(),
      outcome: outcomeOf(
        finished.won(),
        finished.id !== "quest" && cleared.length > 0,
      ),
      quest: finished.id === "quest",
      score: finished.score(),
      stats: finished.stats(),
      trophies: finished.earned(),
    },
    news: newsOf(finished, opened, rank),
    opened,
    progress: placed?.progress ?? progress,
  };
}
