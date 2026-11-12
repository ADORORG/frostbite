import { describe, expect, it } from "vitest";

import { effects } from "../src/audio.ts";
import { soundOf } from "../src/feedback.ts";
import { guide } from "../src/guide.ts";
import type { Target } from "../src/rules/act.ts";
import { handKeys, heroIds } from "../src/rules/constants.ts";
import { choiceIds, momentKinds } from "../src/rules/moments.ts";
import { things } from "../src/rules/things.ts";
import type { News, NewsKind } from "../src/rules/types.ts";
import { heroCards, skillCards } from "../src/script/cast.ts";
import {
  choices,
  clueLines,
  momentTitles,
  relicLines,
} from "../src/script/lines.ts";
import { toastOf } from "../src/script/news.ts";
import { promptFor, relicNames } from "../src/script/prompts.ts";
import { resultOf } from "../src/screen/result.ts";
import { led } from "./support/states.ts";

const news = (kind: NewsKind, detail = ""): News => ({ detail, kind, tick: 1 });
const thingIds = things.map((thing) => thing.id);

describe("the words of the story", () => {
  it("has a card for every hero, a title for every moment, two answers for every choice, and a line for every clue and relic", () => {
    for (const hero of heroIds) {
      expect(heroCards[hero].story.length).toBeGreaterThan(80);
      expect(heroCards[hero].ability).not.toBe("");
    }
    for (const kind of momentKinds) expect(momentTitles[kind]).not.toBe("");
    for (const id of choiceIds) {
      const choice = choices[id];
      expect(choice.truth).not.toBe(choice.trick);
      expect(choice.said).not.toBe("");
    }
    expect(skillCards).toHaveLength(handKeys.length + 2);
    expect(clueLines).toHaveLength(6);
    expect(relicLines).toHaveLength(relicNames.length);
  });

  it("never names the hidden one, nor prints the tongue's decoder, nor claims to heal the player", () => {
    // Only what is shown: the words, not the keys they are kept under.
    const everything = JSON.stringify([
      Object.values(heroCards),
      Object.values(choices),
      Object.values(momentTitles),
      clueLines,
      relicLines,
      skillCards,
      guide,
    ]);
    expect(everything).not.toMatch(/serpent/i);
    expect(everything).not.toMatch(/enjoy us|in joy, us|nJOYus/i);
    expect(everything).not.toMatch(/therap|cure|treat|diagnos/i);
  });

  it("says something for the moments that matter, and nothing for the small ones", () => {
    expect(toastOf(news("sparky"))).toContain("Sparky");
    expect(toastOf(news("found", "zora"))).toBe("Zora walks with you now.");
    expect(toastOf(news("found", "nobody"))).toBeNull();
    expect(toastOf(news("touch"))).toContain("Savage Vision");
    expect(toastOf(news("touch", "again"))).toBe("The tree shows you the way.");
    expect(toastOf(news("level", "3"))).toContain("Level 3");
    expect(toastOf(news("mastered", "2"))).toBe("Knot mastered!");
    expect(toastOf(news("mastered", "99"))).toBe("A skill mastered!");
    expect(toastOf(news("clue", "5"))).toBe(clueLines[5]);
    expect(toastOf(news("relic", "0"))).toBe(relicLines[0]);
    expect(toastOf(news("relic", "9"))).toBeNull();
    for (const kind of [
      "healed",
      "thread",
      "jackets",
      "drawer",
      "lit",
      "power",
      "mirror",
      "reflected",
      "tricked",
      "beat-perfect",
      "beat-good",
      "beat-miss",
      "breath-miss",
      "deck",
      "pancakes",
      "rise",
    ] as const)
      expect(toastOf(news(kind))).not.toBeNull();
    for (const kind of ["plasma", "lamp", "thing", "moment", "vision"] as const)
      expect(toastOf(news(kind))).toBeNull();
    // The lessons, Mama's gift, and poor choices.
    expect(toastOf(news("planted", "0"))).toContain("tend them");
    expect(toastOf(news("bloomed", "1"))).toContain("Love the land");
    expect(toastOf(news("tower"))).toContain("a step at a time");
    expect(toastOf(news("sensed"))).toContain("Mama senses");
    expect(toastOf(news("greying", "1"))).toContain("took some of your colour");
    expect(toastOf(news("greying", "2"))).toContain("going grey");
    expect(toastOf(news("joined"))).toContain("coil");
  });

  it("names what the act key would do, for every kind of thing in reach", () => {
    const state = led();
    const said = (target: Target, at = state) =>
      promptFor(target, at, thingIds);
    expect(said({ id: "tree", kind: "story" })).toBe("Touch the ancestor tree");
    expect(
      said({ id: "tree", kind: "story" }, { ...state, touchedTree: true }),
    ).toBe("Touch the tree");
    for (const id of ["deck", "drawer", "lamp", "loom", "stove"] as const)
      expect(said({ id, kind: "story" })).not.toBe("");
    for (const id of heroIds)
      expect(said({ id, kind: "family" })).toMatch(/Kai|Zora|Mama|Daddy/);
    expect(said({ index: 0, kind: "grey" })).toContain("sly snake");
    expect(said({ index: 0, kind: "thread" })).toContain("maridium");
    expect(said({ index: 0, kind: "clue" })).toBe("Take the clue");
    expect(said({ index: 1, kind: "relic" })).toBe("Take McCoy's oil cup");
    expect(said({ index: 99, kind: "relic" })).toBe("Take the relic");
    expect(said({ index: 0, kind: "mirror" })).toBe("Look into the mirror");
    expect(said({ index: 4, kind: "mirror" })).toBe("Look into the still pond");
    expect(said({ index: 6, kind: "lamp" })).toBe("Light the porch lamp");
    expect(said({ index: 0, kind: "lamp" })).toBe("Switch on the lamp");
    const lit = { ...state, lamps: state.lamps.map(() => true) };
    expect(said({ index: 0, kind: "lamp" }, lit)).toBe("Switch off the lamp");
    thingIds.forEach((_, index) =>
      expect(said({ index, kind: "thing" })).not.toBe("Touch it"),
    );
    expect(said({ index: 999, kind: "thing" })).toBe("Touch it");
  });

  it("has a sound for what happens, each one a real effect", () => {
    for (const kind of [
      "beat-good",
      "beat-miss",
      "beat-perfect",
      "breath-in",
      "breath-out",
      "found",
      "healed",
      "lit",
      "plasma",
      "sparky",
      "tricked",
      "vision",
    ] as const) {
      const effect = soundOf(kind);
      expect(effect === null ? undefined : effects[effect]).toBeDefined();
    }
    expect(soundOf("moment")).toBeNull();
  });

  it("ends a run with a card that says whether the tree was lit, how far the family came, and the best", () => {
    const state = led({ party: ["zora", "ali"], score: 1234, threads: 4 });
    const over = resultOf(state, 2000, false).rows.map((row) => row.text);
    expect(over).toEqual([
      "THE RUN IS OVER",
      "SCORE 1234",
      "FAMILY 3 OF 4  THREADS 4 OF 6",
      "BEST 2000",
      "ENTER TO GO AGAIN",
    ]);
    const lit = resultOf({ ...state, cause: "lit" }, 1234, true);
    expect(lit.rows[0]?.text).toBe("THE TREE IS LIT!");
    expect(lit.rows[3]?.text).toBe("NEW BEST!");
    expect(
      resultOf({ ...state, lead: null }, 0, false).rows[2]?.text,
    ).toContain("FAMILY 0 OF 4");
    // Gone grey is not the end of anything: the next run starts in colour.
    const grey = resultOf({ ...state, cause: "grey" }, 0, false).rows;
    expect(grey[0]?.text).toBe("GONE GREY, FOR NOW");
    expect(grey[2]?.text).toBe("A TRUE WORD BRINGS THE COLOUR BACK");
  });
});
