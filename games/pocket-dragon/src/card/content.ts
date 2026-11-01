import { chapterTitles } from "../chapters.ts";
import type { Progress } from "../progress.ts";
import { chapterIds, type ChapterId } from "../rules/constants.ts";
import { milestoneIds } from "../rules/milestones.ts";
import type { Stat } from "../score.ts";
import { inviteFrom } from "./invite.ts";
import { masterfulMark, trophiesOf, type Trophy } from "./trophy-list.ts";
import {
  chapterMoves,
  chapterNames,
  headlineOf,
  quoteOf,
  rarityNames,
  stamps,
  titleOf,
  type Outcome,
} from "./words.ts";

// What a player's card is made from: the run it tells of (its chapter, how it ended, its score and counts), and the quest so far (the
// chapters open and won, the bests, the milestones and the metaplasma banked), and the link that invites others, when it is known.
export interface CardFacts {
  readonly best: Readonly<Record<ChapterId, number>>;
  readonly chapter: ChapterId;
  readonly invite: string | null;
  readonly masterful: boolean;
  readonly milestoneTotal: number;
  readonly milestones: number;
  readonly outcome: Outcome;
  readonly plasma: number;
  readonly score: number;
  readonly stats: readonly Stat[];
  // The trophies the card shows: the run's own, or every one held when the card is of the quest so far.
  readonly trophies: readonly Trophy[];
  readonly unlocked: number;
  // The castle has been captured, in this run or one before.
  readonly won: boolean;
}

// The last run, as a card tells of it.
export interface LastRun {
  readonly chapter: ChapterId;
  readonly outcome: Outcome;
  readonly score: number;
  readonly stats: readonly Stat[];
  // The milestones the run earned, by id.
  readonly trophies: readonly string[];
}

// A run that cleared the last chapter won it all.
export const outcomeOf = (chapter: ChapterId, cleared: boolean): Outcome =>
  !cleared ? "lost" : chapter === "castle" ? "won" : "cleared";

// What the page knows, as card facts: the saved progress, the last run (if there was one), the milestones the player is known to have
// and their titles, and the referrer of the page, for the invite.
export function factsOf(
  progress: Progress,
  last: LastRun | null,
  marks: ReadonlySet<string>,
  titles: ReadonlyMap<string, string>,
  referrer: string,
): CardFacts {
  return {
    best: progress.best,
    chapter: last?.chapter ?? chapterIds[progress.unlocked - 1] ?? "hills",
    invite: inviteFrom(referrer),
    masterful: marks.has(masterfulMark),
    milestoneTotal: milestoneIds.length,
    milestones: milestoneIds.filter((id) => marks.has(id)).length,
    outcome: last?.outcome ?? "journey",
    plasma: progress.plasma,
    score: last?.score ?? 0,
    stats: last?.stats ?? [],
    trophies: trophiesOf(last?.trophies ?? marks, titles),
    unlocked: progress.unlocked,
    won: progress.won,
  };
}

export type BadgeState = "cleared" | "locked" | "open";

export interface Badge {
  readonly best: string;
  readonly name: string;
  readonly number: number;
  readonly state: BadgeState;
}

export interface Move {
  readonly name: string;
  readonly text: string;
  readonly value: string;
}

// Everything a card prints, as words, and what it is.
export interface CardContent {
  readonly alt: string;
  readonly art: ChapterId;
  readonly badges: readonly Badge[];
  readonly headline: string;
  readonly invite: string;
  readonly link: string | null;
  readonly milestones: string;
  readonly moves: readonly [Move, Move];
  readonly outcome: Outcome;
  readonly plasma: string;
  readonly quote: string;
  readonly rarity: number;
  readonly rarityName: string;
  readonly score: string;
  readonly shareText: string;
  readonly stamp: string;
  readonly title: string;
  readonly trophies: readonly Trophy[];
  readonly trophyHeading: string;
  readonly typeLine: string;
}

// A whole number with its thousands marked, the same in every browser.
export const grouped = (value: number): string =>
  String(Math.max(0, Math.trunc(value))).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");

const compact = (value: string): string => value.replace(" of ", "/");

export function badgesOf(facts: CardFacts): readonly Badge[] {
  return chapterIds.map((id, at) => {
    const cleared = at < facts.unlocked - 1 || (id === "castle" && facts.won);
    return {
      best: grouped(facts.best[id]),
      name: chapterNames[id],
      number: at + 1,
      state: cleared ? "cleared" : at < facts.unlocked ? "open" : "locked",
    };
  });
}

function rarityOf(facts: CardFacts, badges: readonly Badge[]): number {
  if (facts.outcome === "lost") return 1;
  if (facts.outcome === "cleared") return 2;
  if (facts.outcome === "won") return facts.masterful ? 4 : 3;
  if (facts.won) return facts.masterful ? 4 : 3;
  return badges.some((badge) => badge.state === "cleared") ? 2 : 1;
}

function movesOf(
  facts: CardFacts,
  badges: readonly Badge[],
): readonly [Move, Move] {
  if (facts.outcome === "journey")
    return [
      {
        name: "QUEST",
        text: "Chapters cleared so far",
        value: `${String(badges.filter((badge) => badge.state === "cleared").length)}/3`,
      },
      {
        name: "METAPLASMA",
        text: "Banked from every run",
        value: grouped(facts.plasma),
      },
    ];
  const [first, second] = chapterMoves[facts.chapter];
  const value = (stat: number): string =>
    compact(facts.stats[stat]?.[1] ?? "0");
  return [
    { name: first.name, text: first.text, value: value(first.stat) },
    { name: second.name, text: second.text, value: value(second.stat) },
  ];
}

// What the card says in a sentence: for a friend reading beside the picture, and for a screen reader.
function saidOf(facts: CardFacts, cleared: number): string {
  const game = "Pocket Dragon: Glitchy's Quest";
  const chapter = chapterTitles[facts.chapter];
  if (facts.outcome === "won") return `I won it all in ${game}!`;
  if (facts.outcome === "cleared")
    return `I cleared ${chapter.replace(/^The /u, "the ")} in ${game}!`;
  if (facts.outcome === "lost")
    return `${chapter} got me this time in ${game}. Think you can do better?`;
  return `My quest in ${game} so far: ${String(cleared)} of 3 chapters cleared.`;
}

export function cardOf(facts: CardFacts): CardContent {
  const badges = badgesOf(facts);
  const cleared = badges.filter((badge) => badge.state === "cleared").length;
  const rarity = rarityOf(facts, badges);
  const furthest =
    chapterIds[Math.max(0, Math.min(chapterIds.length, facts.unlocked) - 1)] ??
    "hills";
  const art =
    facts.outcome === "journey"
      ? furthest
      : facts.outcome === "won"
        ? "castle"
        : facts.chapter;
  const headline = headlineOf(facts.outcome, facts.chapter);
  const score = grouped(
    facts.outcome === "journey"
      ? Object.values(facts.best).reduce((sum, best) => sum + best, 0)
      : facts.score,
  );
  const milestones = `${String(facts.milestones)}/${String(facts.milestoneTotal)}`;
  const said = saidOf(facts, cleared);
  return {
    alt: `A Pocket Dragon card. ${said} ${score} points, ${milestones} milestones.`,
    art,
    badges,
    headline,
    invite:
      facts.invite === null
        ? "FIND POCKET DRAGON IN THE ARCADE"
        : facts.invite.replace(/^https?:\/\//u, ""),
    link: facts.invite,
    milestones,
    moves: movesOf(facts, badges),
    outcome: facts.outcome,
    plasma: grouped(facts.plasma),
    quote: quoteOf(
      facts.outcome,
      facts.score + chapterIds.indexOf(facts.chapter),
    ),
    rarity,
    rarityName: rarityNames[rarity - 1] ?? "SPARK",
    score,
    shareText:
      facts.invite === null
        ? `${said} Find it in the arcade.`
        : `${said} Join me: ${facts.invite}`,
    stamp: stamps[facts.outcome],
    title: titleOf(facts.outcome, facts.chapter, facts.masterful),
    trophies: facts.trophies,
    trophyHeading:
      facts.outcome === "journey" ? "TROPHY CASE" : "TROPHIES THIS RUN",
    typeLine: `BABY DRAGON  ·  ${facts.outcome === "journey" ? `${String(cleared)} OF 3 CLEARED` : `CHAPTER ${String(chapterIds.indexOf(art) + 1)} OF 3`}`,
  };
}
