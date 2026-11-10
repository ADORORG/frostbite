import { describe, expect, it } from "vitest";

import { targetOf } from "../src/rules/act.ts";
import { canMake, creations } from "../src/rules/create.ts";
import { earnedBy } from "../src/rules/milestones.ts";
import { cardFor } from "../src/script/cards.ts";
import { creationBy, madeWords } from "../src/script/creations.ts";
import { toastOf } from "../src/script/news.ts";
import { promptFor } from "../src/script/prompts.ts";
import { accepted, at, led, playThrough } from "./support/states.ts";

// What each of the family makes once their lesson is learned, and the family keeps: Kai's hologram, Zora's masterpiece, Mama's song and
// Daddy's relic.
const milestoneOf = {
  ali: "ali-relic",
  heerah: "heerah-song",
  kai: "kai-hologram",
  zora: "zora-masterpiece",
} as const;

describe("what the family makes and keeps", () => {
  for (const creation of creations)
    it(`${creation.id}: made by ${creation.hero} once their lesson is learned, then kept`, () => {
      // Ready: the maker leads, Sparky is found, Kai's tower stands and Daddy's drawer is open.
      const ready = at(
        led({ drawer: true, lead: creation.hero, sparky: true, tower: true }),
        creation.at,
      );
      expect(canMake(ready, creation)).toBe(true);
      expect(targetOf(ready)).toEqual({ id: creation.id, kind: "story" });
      expect(promptFor({ id: creation.id, kind: "story" }, ready, [])).toBe(
        madeWords(creation.hero)?.prompt,
      );
      // Not yet: without the maker in the family, or before what must come first.
      const away = creation.hero === "kai" ? "zora" : "kai";
      expect(canMake({ ...ready, lead: away }, creation)).toBe(false);
      expect(
        canMake(
          { ...ready, drawer: false, sparky: false, tower: false },
          creation,
        ),
      ).toBe(false);
      // Made: a moment of keys and breath, played through, and kept for the rest of the run.
      const making = accepted(ready, "act");
      expect(making.moment?.kind).toBe(creation.id);
      const made = playThrough(making);
      expect(made.made).toEqual([creation.hero]);
      expect(made.news).toMatchObject({ detail: creation.hero, kind: "made" });
      expect(earnedBy(made)).toContain(milestoneOf[creation.hero]);
      expect(earnedBy(ready)).not.toContain(milestoneOf[creation.hero]);
      expect(canMake(made, creation)).toBe(false);
      expect(creationBy[creation.hero]).toBe(creation.id);
      const news = made.news;
      if (news === null) throw new Error("no news");
      expect(toastOf(news)).toBe(madeWords(creation.hero)?.toast);
      expect(cardFor(news, made)).toEqual(madeWords(creation.hero)?.card);
    });

  it("has no words for news that names nobody in the family", () => {
    expect(madeWords("nobody")).toBeNull();
    expect(toastOf({ detail: "nobody", kind: "made", tick: 1 })).toBeNull();
  });
});
