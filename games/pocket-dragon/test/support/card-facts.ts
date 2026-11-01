import type { CardFacts } from "../../src/card/content.ts";
import { trophiesOf } from "../../src/card/trophy-list.ts";

// The facts of one card for the tests of cards: a run of Egg Hills cleared with the quest at chapter two, two trophies won in it, and
// the platform's page known, so the card carries its link.
export const link = "https://play.example.com/games/pocket-dragon";
export const facts: CardFacts = {
  best: { castle: 0, hills: 12_840, woods: 9_100 },
  chapter: "hills",
  invite: link,
  masterful: false,
  milestoneTotal: 39,
  milestones: 12,
  outcome: "cleared",
  plasma: 1_204,
  score: 12_840,
  stats: [
    ["Eggs", "72"],
    ["Hearts", "3"],
    ["Stage", "3 of 3"],
  ],
  trophies: trophiesOf(["first-egg", "hills-clear"], new Map()),
  unlocked: 2,
  won: false,
};
