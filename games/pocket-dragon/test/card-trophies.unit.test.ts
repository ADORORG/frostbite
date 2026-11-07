import { describe, expect, it } from "vitest";

import { cardOf } from "../src/card/content.ts";
import { gamePath, inviteFrom } from "../src/card/invite.ts";
import {
  titleFromId,
  trophiesOf,
  trophyKindOf,
} from "../src/card/trophy-list.ts";
import { facts, link } from "./support/card-facts.ts";

describe("the invite on a card", () => {
  it("is the platform's page for the game, read from the page that frames it, and nothing anywhere else", () => {
    expect(gamePath).toBe("/games/pocket-dragon");
    expect(inviteFrom("https://play.example.com/games/pocket-dragon")).toBe(
      link,
    );
    expect(
      inviteFrom("https://play.example.com/games/pocket-dragon/?ref=x#top"),
    ).toBe(link);
    expect(inviteFrom("http://localhost:3000/games/pocket-dragon")).toBe(
      "http://localhost:3000/games/pocket-dragon",
    );
    for (const elsewhere of [
      "",
      "about:srcdoc",
      "not a url",
      "https://play.example.com/",
      "https://play.example.com/games/other-game",
      "ftp://play.example.com/games/pocket-dragon",
      "data:text/html,hi",
    ])
      expect(inviteFrom(elsewhere)).toBeNull();
  });
});

describe("the trophies on a card", () => {
  it("are the game's own milestones, each once, the masterful charm first and then the hardest won first", () => {
    const titles = new Map([
      ["masterful-charm", "Masterful Pocket Dragon Charm"],
      ["first-egg", "First egg"],
    ]);
    const trophies = trophiesOf(
      [
        "first-egg",
        "woods-escape",
        "masterful-charm",
        "hills-clear",
        "first-egg",
        "made-up",
      ],
      titles,
    );
    expect(trophies).toEqual([
      {
        id: "masterful-charm",
        kind: "masterful",
        title: "MASTERFUL POCKET DRAGON CHARM",
      },
      { id: "woods-escape", kind: "woods", title: "WOODS ESCAPE" },
      { id: "hills-clear", kind: "hills", title: "HILLS CLEAR" },
      { id: "first-egg", kind: "hills", title: "FIRST EGG" },
    ]);
    expect(trophiesOf([], titles)).toEqual([]);
  });

  it("are coloured by where they were won, and named from their id when the platform has not named them", () => {
    expect(
      [
        "eggs-60",
        "woods-lanterns",
        "guild-gear",
        "secret-charm",
        "metaplasma-300",
        "masterful-charm",
        "quest-swift",
      ].map(trophyKindOf),
    ).toEqual([
      "hills",
      "woods",
      "castle",
      "shared",
      "shared",
      "masterful",
      "quest",
    ]);
    expect(titleFromId("quest-all-hearts")).toBe("QUEST ALL HEARTS");
  });

  it("are headed as the run's own on a run's card, and as the trophy case on a card of the quest", () => {
    expect(cardOf(facts)).toMatchObject({ trophyHeading: "TROPHIES THIS RUN" });
    expect(cardOf(facts).trophies.map(({ id }) => id)).toEqual([
      "hills-clear",
      "first-egg",
    ]);
    expect(cardOf({ ...facts, outcome: "journey" }).trophyHeading).toBe(
      "TROPHY CASE",
    );
  });
});
