import { describe, expect, it } from "vitest";

import {
  badgesOf,
  cardOf,
  factsOf,
  grouped,
  outcomeOf,
} from "../src/card/content.ts";
import { quoteOf } from "../src/card/words.ts";
import { freshProgress } from "../src/progress.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { facts, link } from "./support/card-facts.ts";

describe("a card's words", () => {
  it("say a cleared chapter, with its moves from the run's counts and its best of the bests", () => {
    const card = cardOf(facts);
    expect(card).toMatchObject({
      art: "hills",
      headline: "I CLEARED EGG HILLS!",
      invite: "play.example.com/games/pocket-dragon",
      link,
      milestones: "12/39",
      outcome: "cleared",
      plasma: "1,204",
      rarity: 2,
      rarityName: "FLAME",
      score: "12,840",
      stamp: "CLEARED!",
      title: "HILL RUNNER",
      typeLine: "BABY DRAGON  ·  CHAPTER 1 OF 3",
    });
    expect(card.moves).toEqual([
      { name: "EGG SNATCH", text: "Eggs caught on the run", value: "72" },
      { name: "PORTAL DASH", text: "Stage reached of three", value: "3/3" },
    ]);
    expect(card.badges.map((badge) => badge.state)).toEqual([
      "cleared",
      "open",
      "locked",
    ]);
    expect(card.shareText).toBe(
      `I cleared Egg Hills in Pocket Dragon: Glitchy's Quest! Join me: ${link}`,
    );
    expect(card.alt).toContain("I cleared Egg Hills");
    expect(card.alt).toContain("12,840 points, 12/39 milestones.");
  });

  it("say a lost run plainly but kindly, as a spark, and ask friends to find the game when there is no link", () => {
    const card = cardOf({
      ...facts,
      chapter: "woods",
      invite: null,
      outcome: "lost",
      score: 4_200,
      stats: [
        ["Clues", "2 of 3"],
        ["Parts", "1 of 4"],
        ["Eggs", "4"],
      ],
    });
    expect(card).toMatchObject({
      art: "woods",
      headline: "THE WOODS KEPT ME... FOR NOW",
      invite: "FIND POCKET DRAGON IN THE ARCADE",
      link: null,
      rarity: 1,
      rarityName: "SPARK",
      stamp: "TRY AGAIN!",
      title: "BRAVE CHALLENGER",
    });
    expect(card.moves.map((move) => move.value)).toEqual(["2/3", "1/4"]);
    expect(card.shareText).toBe(
      "The Whispering Woods got me this time in Pocket Dragon: Glitchy's Quest. Think you can do better? Find it in the arcade.",
    );
    expect(
      cardOf({ ...facts, chapter: "woods", outcome: "cleared" }).shareText,
    ).toContain("I cleared the Whispering Woods");
  });

  it("say a win as a blaze with the castle drawn, and as masterful once the masterful charm is earned", () => {
    const won = {
      ...facts,
      chapter: "castle" as const,
      outcome: "won" as const,
      unlocked: 3,
      won: true,
    };
    expect(cardOf(won)).toMatchObject({
      art: "castle",
      headline: "I WON IT ALL!",
      rarity: 3,
      rarityName: "BLAZE",
      stamp: "WON IT ALL!",
      title: "CASTLE CHAMPION",
      typeLine: "BABY DRAGON  ·  CHAPTER 3 OF 3",
    });
    expect(cardOf(won).badges.every((badge) => badge.state === "cleared")).toBe(
      true,
    );
    expect(cardOf({ ...won, masterful: true })).toMatchObject({
      rarity: 4,
      rarityName: "MASTERFUL",
      title: "MASTERFUL POCKET DRAGON",
    });
    expect(cardOf(won).shareText).toContain("I won it all in Pocket Dragon");
  });

  it("tell the quest so far when there is no run to tell of: the furthest chapter, the bests added up, and the bank", () => {
    const journey = {
      ...facts,
      outcome: "journey" as const,
      score: 0,
      stats: [],
    };
    expect(cardOf(journey)).toMatchObject({
      art: "woods",
      headline: "MY POCKET DRAGON QUEST",
      rarity: 2,
      score: "21,940",
      stamp: "ON THE QUEST",
      title: "QUESTING HATCHLING",
      typeLine: "BABY DRAGON  ·  1 OF 3 CLEARED",
    });
    expect(cardOf(journey).moves).toEqual([
      { name: "QUEST", text: "Chapters cleared so far", value: "1/3" },
      { name: "METAPLASMA", text: "Banked from every run", value: "1,204" },
    ]);
    expect(cardOf({ ...journey, unlocked: 1 })).toMatchObject({
      art: "hills",
      rarity: 1,
    });
    expect(cardOf({ ...journey, unlocked: 3, won: true })).toMatchObject({
      art: "castle",
      rarity: 3,
    });
    expect(
      cardOf({ ...journey, masterful: true, unlocked: 3, won: true }),
    ).toMatchObject({ rarity: 4, title: "MASTERFUL POCKET DRAGON" });
    expect(cardOf(journey).shareText).toBe(
      `My quest in Pocket Dragon: Glitchy's Quest so far: 1 of 3 chapters cleared. Join me: ${link}`,
    );
  });

  it("carry a quote picked by the score, so every size says the same, and a count of zero when a count is missing", () => {
    expect(cardOf(facts).quote).toBe(cardOf({ ...facts }).quote);
    expect(cardOf(facts).quote).toBe(quoteOf("cleared", 12_840));
    expect(new Set([0, 1, 2].map((pick) => quoteOf("lost", pick))).size).toBe(
      3,
    );
    expect(quoteOf("won", -4)).toBe(quoteOf("won", 4));
    expect(
      cardOf({ ...facts, stats: [] }).moves.map((move) => move.value),
    ).toEqual(["0", "0"]);
  });

  it("group thousands the same in every browser, and never print below zero", () => {
    expect([0, 999, 1_000, 21_940, 1_234_567, -5, 12.9].map(grouped)).toEqual([
      "0",
      "999",
      "1,000",
      "21,940",
      "1,234,567",
      "0",
      "12",
    ]);
  });
});

describe("the quest on a card", () => {
  it("counts a chapter cleared once the next is open, and the castle once it is captured", () => {
    const states = (unlocked: number, won: boolean) =>
      badgesOf({ ...facts, unlocked, won }).map((badge) => badge.state);
    expect(states(1, false)).toEqual(["open", "locked", "locked"]);
    expect(states(3, false)).toEqual(["cleared", "cleared", "open"]);
    expect(states(3, true)).toEqual(["cleared", "cleared", "cleared"]);
    expect(
      badgesOf(facts).map((badge) => [badge.number, badge.name, badge.best]),
    ).toEqual([
      [1, "EGG HILLS", "12,840"],
      [2, "THE WHISPERING WOODS", "9,100"],
      [3, "THE GUILD AND THE CASTLE", "0"],
    ]);
  });

  it("is made from what the page knows: the saved progress, the last run and its trophies, the milestones held and the page's referrer", () => {
    const marks = new Set(["first-egg", "masterful-charm", "not-a-milestone"]);
    const progress = { ...freshProgress, plasma: 50, unlocked: 3, won: true };
    const titles = new Map([["guild-castle", "Castle captured"]]);
    const last = {
      chapter: "castle" as const,
      outcome: outcomeOf("castle", true),
      score: 900,
      stats: [],
      trophies: ["guild-castle", "nothing-of-ours"],
    };
    expect(factsOf(progress, last, marks, titles, `${link}?x=1`)).toEqual({
      best: progress.best,
      chapter: "castle",
      invite: link,
      masterful: true,
      milestoneTotal: milestoneIds.length,
      milestones: 2,
      outcome: "won",
      plasma: 50,
      score: 900,
      stats: [],
      trophies: [
        { id: "guild-castle", kind: "castle", title: "CASTLE CAPTURED" },
      ],
      unlocked: 3,
      won: true,
    });
    // With no run to tell of, the card shows every trophy held.
    expect(
      factsOf(progress, null, marks, titles, "").trophies.map(({ id }) => id),
    ).toEqual(["masterful-charm", "first-egg"]);
    expect(
      factsOf(freshProgress, null, new Set(), new Map(), ""),
    ).toMatchObject({
      chapter: "hills",
      invite: null,
      masterful: false,
      milestones: 0,
      outcome: "journey",
      score: 0,
    });
    expect([
      outcomeOf("hills", false),
      outcomeOf("woods", true),
      outcomeOf("castle", false),
    ]).toEqual(["lost", "cleared", "lost"]);
  });
});
