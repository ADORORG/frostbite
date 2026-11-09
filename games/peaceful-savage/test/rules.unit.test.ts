import { describe, expect, it } from "vitest";

import { targetOf } from "../src/rules/act.ts";
import { maxTicks } from "../src/rules/constants.ts";
import {
  blocked,
  headingTo,
  stepToward,
  zoneAt,
} from "../src/rules/geometry.ts";
import { savageRules } from "../src/rules/index.ts";
import {
  familyFacing,
  familySpots,
  places,
  walls,
} from "../src/rules/layout.ts";
import { startRun, withColour } from "../src/rules/state.ts";
import { lamps, things } from "../src/rules/things.ts";
import { advanceTo } from "../src/rules/tick.ts";
import { accepted, led, refusal } from "./support/states.ts";

describe("a run's start", () => {
  it("is the same for the same seed and differs between seeds", () => {
    expect(startRun(5)).toEqual(startRun(5));
    const spots = (seed: number) =>
      startRun(seed)
        .greys.map(({ spot }) => spot)
        .join("");
    const answers = (seed: number) => startRun(seed).answers.join("");
    expect(
      [1, 2, 3, 4, 5].map((seed) => spots(seed) + answers(seed)),
    ).not.toEqual(Array.from({ length: 5 }, () => spots(1) + answers(1)));
    const fresh = startRun(9);
    expect(fresh.lead).toBeNull();
    expect(fresh.colour.every((value) => value === 8)).toBe(true);
    expect(fresh.lamps.some(Boolean)).toBe(false);
  });

  it("refuses settings, and inputs it does not know", () => {
    expect(savageRules.init(1, { speed: 2 })).toEqual({
      ok: false,
      reason: "no such setting: speed",
    });
    expect(refusal(startRun(1), "jump")).toBe("no such input: jump");
  });

  it("takes one lead, before anything else", () => {
    const fresh = startRun(3);
    expect(refusal(fresh, "move", { way: 4 })).toBe("nobody leads yet");
    expect(refusal(fresh, "act")).toBe("nobody leads yet");
    expect(refusal(fresh, "vision")).toBe("nobody leads yet");
    expect(refusal(fresh, "lead", { hero: 4 })).toBe("a hero is 0 to 3");
    expect(refusal(fresh, "lead", { hero: 1.5 })).toBe("a hero is 0 to 3");
    expect(refusal(fresh, "lead", { hero: "kai" })).toBe("a hero is 0 to 3");
    const chosen = accepted(fresh, "lead", { hero: 3 });
    expect(chosen.lead).toBe("ali");
    expect(refusal(chosen, "lead", { hero: 0 })).toBe(
      "the lead is already chosen",
    );
  });

  it("refuses a tick out of order or past the longest run, and anything once ended", () => {
    const state = led({ tick: 40 });
    expect(refusal(state, "act", { tick: 39 })).not.toBe("");
    expect(refusal(state, "act", { tick: maxTicks + 1 })).not.toBe("");
    expect(refusal(state, "move", { extra: 1, way: 2 })).not.toBe("");
    const ended = accepted(state, "end");
    expect(ended.cause).toBe("left");
    expect(refusal(ended, "act")).toBe("the run has ended");
  });
});

describe("walking", () => {
  it("walks one of sixteen ways, and stands still on -1", () => {
    const state = accepted(led(), "move", { way: 8 });
    const later = advanceTo(state, 10);
    expect(later.z).toBeGreaterThan(state.z);
    expect(later.x).toBe(state.x);
    expect(accepted(later, "move", { way: -1 }).facing).toBe(8);
    expect(refusal(state, "move", { way: 16 })).toBe("a way is -1 or 0 to 15");
    expect(refusal(state, "move", { way: "north" })).toBe("a way is a number");
  });

  it("runs eight fifths as fast when asked, and walks again when asked", () => {
    const start = led({ x: 0, z: -6_000 });
    const walked = advanceTo(accepted(start, "move", { way: 8 }), 20);
    const ran = advanceTo(
      accepted(accepted(start, "hurry", { fast: 1 }), "move", { way: 8 }),
      20,
    );
    expect(ran.hurrying).toBe(true);
    expect(ran.z - start.z).toBeGreaterThan(
      Math.trunc(((walked.z - start.z) * 3) / 2),
    );
    expect(accepted(ran, "hurry", { fast: 0 }).hurrying).toBe(false);
    expect(refusal(start, "hurry", { fast: 2 })).toBe("fast is 0 or 1");
    expect(refusal(start, "hurry", { fast: "yes" })).toBe("fast is a number");
    expect(refusal(startRun(3), "hurry", { fast: 1 })).toBe("nobody leads yet");
  });

  it("is stopped by walls, slides along them, and rounds a corner met head on", () => {
    const into = { x: 0, z: 400 };
    expect(stepToward(into, 0, 60, walls).z).toBeGreaterThanOrEqual(
      into.z - 60,
    );
    const stopped = advanceTo(
      accepted(led({ x: -2_000, z: 400 }), "move", { way: 0 }),
      60,
    );
    expect(stopped.z).toBeGreaterThan(0);
    const slid = stepToward({ x: -2_600, z: 2_000 }, 13, 60, walls);
    expect(slid.z).toBeLessThan(2_000);
    expect(blocked({ x: 0, z: 6_000 }, walls)).toBe(true);
    const corner = stepToward({ x: -6_290, z: 4_743 }, 4, 62, walls);
    expect(corner).not.toEqual({ x: -6_290, z: 4_743 });
    expect(stepToward({ x: 0, z: 6_000 }, 0, 60, walls)).toEqual({
      x: 0,
      z: 6_000,
    });
  });

  it("leaves the front door open, so the porch and the meadow are home from the start", () => {
    const out = advanceTo(
      accepted(led({ x: 0, z: 400 }), "move", { way: 0 }),
      40,
    );
    expect(zoneAt(out)).toBe("meadow");
  });

  it("starts the lead at their own place: Daddy in the office, Kai on the porch, Zora in the meadow, Mama at the tree", () => {
    const start = (hero: number) => accepted(startRun(5), "lead", { hero });
    const zones = [0, 1, 2, 3].map((hero) => zoneAt(start(hero)));
    expect(zones).toEqual(["meadow", "meadow", "hall", "office"]);
    expect(start(0).facing).toBe(familyFacing.kai);
    expect(start(2)).toMatchObject(familySpots.heerah);
    expect(start(3)).toMatchObject({ facing: 0, x: 8_400, z: 3_900 });
  });

  it("names the room a place is in, and the nearest heading to a place", () => {
    expect(zoneAt({ x: 0, z: -5 })).toBe("meadow");
    expect(zoneAt({ x: 2_000, z: 3_000 })).toBe("hall");
    expect(zoneAt({ x: -5_000, z: 3_000 })).toBe("kitchen");
    expect(zoneAt({ x: -5_000, z: 9_000 })).toBe("kids");
    expect(zoneAt({ x: 5_000, z: 3_000 })).toBe("office");
    expect(zoneAt({ x: 5_000, z: 9_000 })).toBe("parents");
    expect(headingTo({ x: 0, z: 0 }, { x: 0, z: -10 })).toBe(0);
    expect(headingTo({ x: 0, z: 0 }, { x: 10, z: 10 })).toBe(6);
  });
});

describe("reaching for things", () => {
  it("reaches nothing out of reach, or through a wall", () => {
    expect(refusal(led({ x: 0, z: 1_800 }), "act")).toBe(
      "there is nothing in reach to act on",
    );
    const coats = things.findIndex(({ id }) => id === "coats");
    expect(targetOf(led({ x: -2_640, z: 1_600 }))).toEqual({
      index: coats,
      kind: "thing",
    });
    expect(targetOf(startRun(1))).toBeNull();
  });

  it("touches the tree, which gives vision, and again for a clue", () => {
    const touched = accepted(led({ x: 0, z: 4_600 }), "act");
    expect(touched.touchedTree).toBe(true);
    expect(touched.score).toBe(50);
    const again = accepted(touched, "act");
    expect(again.news).toMatchObject({ detail: "again", kind: "touch" });
    expect(again.score).toBe(50);
  });

  it("pulls a card from the deck, and makes pancakes, once each", () => {
    const deck = accepted(
      led({ touchedTree: true, x: 1_900, z: 6_000 }),
      "act",
    );
    expect(deck.deck).toBe(true);
    expect(targetOf({ ...deck, x: 1_900 })).not.toEqual({
      id: "deck",
      kind: "story",
    });
    const pancakes = accepted(led({ x: -8_000, z: 1_300 }), "act");
    expect(pancakes.pancakes).toBe(true);
    expect(pancakes.colour[2]).toBe(18);
  });

  it("forges Sparky only once the tree has been touched", () => {
    expect(targetOf(led({ x: 1_300, z: 11_800 }))).not.toEqual({
      id: "lamp",
      kind: "story",
    });
    const lamp = led({ touchedTree: true, x: 1_300, z: 11_800 });
    expect(targetOf(lamp)).toEqual({ id: "lamp", kind: "story" });
    expect(accepted(lamp, "act").moment?.kind).toBe("forge");
  });

  it("turns lamps on and off, and keeps that every lamp was once on", () => {
    let state = led({ sparky: true });
    lamps.forEach((lamp, index) => {
      state = accepted(
        { ...state, x: lamp.x + (lamp.x > 0 ? -300 : 300), z: lamp.z },
        "act",
      );
      expect(state.lamps[index]).toBe(true);
    });
    expect(state.lampsAllOn).toBe(true);
    const off = accepted(
      { ...state, x: lamps[0]?.x ?? 0, z: (lamps[0]?.z ?? 0) + 300 },
      "act",
    );
    expect(off.lamps[0]).toBe(false);
    expect(off.lampsAllOn).toBe(true);
    expect(off.score).toBe(state.score);
  });

  it("touches a thing once for points and colour, then only toggles it", () => {
    const juice = things.findIndex(({ id }) => id === "juice");
    const first = accepted(
      led({ party: ["zora"], x: -7_200, z: 4_400 }),
      "act",
    );
    expect(first.thingsTouched[juice]).toBe(true);
    expect(first.score).toBe(10);
    const second = accepted(first, "act");
    expect(second.thingsOn[juice]).toBe(false);
    expect(second.score).toBe(10);
  });

  it("raises a room's colour, but never past where it waits for the tree", () => {
    expect(withColour(led(), "hall", 200).colour[1]).toBe(90);
    expect(places.tree).toEqual({ x: 0, z: 6_000 });
  });
});
