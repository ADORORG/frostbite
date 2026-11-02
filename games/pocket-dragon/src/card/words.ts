import type { ChapterId } from "../rules/constants.ts";

// The words on a player's card: what it says over the card for each way a run can end, the title under Glitchy's name, the stamp on the
// picture, the two moves each chapter's card shows, and the quotes. A card is about one run that was cleared, lost or won it all, or
// about the quest so far when there is no run to tell of.
export type Outcome = "cleared" | "journey" | "lost" | "won";

// Every chapter's card in capitals, as it is printed.
export const chapterNames: Readonly<Record<ChapterId, string>> = {
  castle: "THE GUILD AND THE CASTLE",
  hills: "EGG HILLS",
  woods: "THE WHISPERING WOODS",
};

const wonLine = "I WON IT ALL!";
const clearedLines: Readonly<Record<ChapterId, string>> = {
  castle: "I STORMED THE CASTLE!",
  hills: "I CLEARED EGG HILLS!",
  woods: "I ESCAPED THE WHISPERING WOODS!",
};
const lostLines: Readonly<Record<ChapterId, string>> = {
  castle: "THE CASTLE HELD OUT... FOR NOW",
  hills: "EGG HILLS GOT ME... FOR NOW",
  woods: "THE WOODS KEPT ME... FOR NOW",
};

export function headlineOf(outcome: Outcome, chapter: ChapterId): string {
  if (outcome === "won") return wonLine;
  if (outcome === "cleared") return clearedLines[chapter];
  if (outcome === "lost") return lostLines[chapter];
  return "MY POCKET DRAGON QUEST";
}

const championTitle = "QUEST CHAMPION";
const clearedTitles: Readonly<Record<ChapterId, string>> = {
  castle: "CASTLE STORMER",
  hills: "HILL RUNNER",
  woods: "MOON GATE OPENER",
};

export function titleOf(
  outcome: Outcome,
  chapter: ChapterId,
  masterful: boolean,
): string {
  if (outcome === "won" || (outcome === "journey" && masterful))
    return masterful ? "MASTERFUL POCKET DRAGON" : championTitle;
  if (outcome === "cleared") return clearedTitles[chapter];
  return outcome === "lost" ? "BRAVE CHALLENGER" : "QUESTING HATCHLING";
}

export const stamps: Readonly<Record<Outcome, string>> = {
  cleared: "CLEARED!",
  journey: "ON THE QUEST",
  lost: "TRY AGAIN!",
  won: "WON IT ALL!",
};

// The rarity of a card, from a spark (a run that fell short, or a quest just begun) to masterful (the masterful charm earned).
export const rarityNames = ["SPARK", "FLAME", "BLAZE", "MASTERFUL"] as const;

// A chapter card's two moves: each names one of the run's three counts (`stat`, by its place in the chapter's stats).
export interface MoveWords {
  readonly name: string;
  readonly stat: number;
  readonly text: string;
}

export const chapterMoves: Readonly<
  Record<ChapterId, readonly [MoveWords, MoveWords]>
> = {
  castle: [
    { name: "GUILD LEVEL", stat: 0, text: "The guild's level, one to ten" },
    { name: "EGG RESCUE", stat: 2, text: "Eggs saved from DeFu's guards" },
  ],
  hills: [
    { name: "EGG SNATCH", stat: 0, text: "Eggs caught on the run" },
    { name: "PORTAL DASH", stat: 2, text: "Stage reached of three" },
  ],
  woods: [
    { name: "CLUE SENSE", stat: 0, text: "Clue stones read in the maze" },
    { name: "LAUNCHER BUILD", stat: 1, text: "Egg launcher parts found" },
  ],
};

// A quest card's two moves: the time on the clock and the hearts kept (the quest's stats are time, hearts and level).
export const questMoves: readonly [MoveWords, MoveWords] = [
  { name: "SPEED RUN", stat: 0, text: "Time on the quest clock" },
  { name: "HEART GUARD", stat: 1, text: "Hearts kept to the very end" },
];

// The quote on a card. Each is our own; one is picked by the run's score, so a card says the same thing in every size.
const quotes: Readonly<Record<Outcome, readonly string[]>> = {
  cleared: [
    "One chapter down, and the quest is only getting started.",
    "Small wings, big leaps: nothing stands between me and the next portal.",
    "The path was dark and twisty, but I found my way out.",
  ],
  journey: [
    "Every legend starts out as a tiny egg.",
    "The dragon is small, the quest is long, and the adventure is huge.",
    "Some heroes roar. This one hatches a plan.",
  ],
  lost: [
    "Even the smallest flame comes back brighter.",
    "Knocked down, not out: Glitchy is already stretching its wings.",
    "Every great dragon tumbled a few times first.",
  ],
  won: [
    "Three dimensions, one tiny dragon, and a rocket that never left the ground.",
    "Eggs saved, clues read, friends made: every dragon is free again.",
    "They said DeFu could not be stopped. Nobody told Glitchy.",
  ],
};

export function quoteOf(outcome: Outcome, pick: number): string {
  const list = quotes[outcome];
  return list[Math.abs(Math.trunc(pick)) % list.length] ?? "";
}
