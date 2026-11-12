import { describe, expect, it } from "vitest";

import { startPlay } from "../src/page/run.ts";
import { suggestedSkill } from "../src/page/practice.ts";
import { north, pushOf, wayFor } from "../src/page/steer.ts";
import { breathSkill, huddleSkill, masteryCap } from "../src/rules/growth.ts";
import { familySpots } from "../src/rules/layout.ts";
import type { News } from "../src/rules/types.ts";
import { led } from "./support/states.ts";

describe("steering by the screen", () => {
  it("turns a push into one of the sixteen ways, seen from where the camera looks", () => {
    expect(wayFor({ x: 0, y: 1 }, north)).toBe(0);
    expect(wayFor({ x: 1, y: 0 }, north)).toBe(4);
    expect(wayFor({ x: 0, y: -1 }, north)).toBe(8);
    expect(wayFor({ x: -1, y: 0 }, north)).toBe(12);
    expect(wayFor({ x: 1, y: 1 }, north)).toBe(2);
    // Looking east (+x), up walks east and right walks south.
    expect(wayFor({ x: 0, y: 1 }, { x: 1, z: 0 })).toBe(4);
    expect(wayFor({ x: 1, y: 0 }, { x: 1, z: 0 })).toBe(8);
    expect(wayFor({ x: 0, y: 0 }, north)).toBe(-1);
    expect(wayFor({ x: 0, y: 1 }, { x: 0, z: 0 })).toBe(-1);
  });

  it("adds up the keys held, opposite keys cancelling", () => {
    expect(pushOf({ down: false, left: true, right: false, up: true })).toEqual(
      {
        x: -1,
        y: 1,
      },
    );
    expect(pushOf({ down: true, left: true, right: true, up: true })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("the skill a touch screen's Practise button picks", () => {
  it("is the huddle once the jackets are woven with family about, else the key practised least, else the breath", () => {
    const state = led();
    expect(suggestedSkill(state)).toBe(0);
    expect(
      suggestedSkill({ ...state, mastery: [5, 2, 9, 9, 9, 9, 0, 0] }),
    ).toBe(1);
    const keys = [...Array<number>(6).fill(masteryCap), 0, 0];
    expect(suggestedSkill({ ...state, mastery: keys })).toBe(breathSkill);
    const breathed = [...Array<number>(7).fill(masteryCap), 0];
    expect(suggestedSkill({ ...state, mastery: breathed })).toBe(breathSkill);
    expect(
      suggestedSkill({ ...state, mastery: breathed, party: ["zora"] }),
    ).toBe(huddleSkill);
    expect(suggestedSkill({ ...state, jackets: true, party: ["zora"] })).toBe(
      huddleSkill,
    );
  });
});

describe("a run as the page plays it", () => {
  it("records the lead first, then walks the way pushed, once, until the push changes", () => {
    const heard: News[] = [];
    const play = startPlay({
      hero: "heerah",
      onNews: (news) => heard.push(news),
      seed: 5,
    });
    expect(play.state().lead).toBe("heerah");
    expect(play.state().x).toBe(familySpots.heerah.x);
    play.steer({ x: 0, y: 1 }, north);
    expect(play.state().moving).toBe(0);
    play.steer({ x: 0, y: 2 }, north);
    play.tick(10);
    expect(play.previous().tick).toBe(0);
    expect(play.state().tick).toBe(10);
    play.tick(0);
    expect(play.state().tick).toBe(10);
    play.steer(null, north);
    expect(play.state().moving).toBe(-1);
    const record = play.record();
    expect(record.inputs.map((input) => input.type)).toEqual([
      "lead",
      "move",
      "move",
      "end",
    ]);
    expect(heard).toEqual([]);
  });

  it("runs only while walking, asking the rules only when that changes", () => {
    const play = startPlay({ hero: "zora", seed: 7 });
    play.steer(null, north, true);
    expect(play.state().hurrying).toBe(false);
    play.steer({ x: 0, y: 1 }, north, true);
    expect(play.state().hurrying).toBe(true);
    play.steer({ x: 1, y: 1 }, north, true);
    play.tick(5);
    play.steer({ x: 1, y: 1 }, north, false);
    expect(play.state().hurrying).toBe(false);
    play.steer({ x: 0, y: 1 }, north, true);
    play.steer(null, north, true);
    expect(play.state().hurrying).toBe(false);
    expect(play.record().inputs.map((input) => input.type)).toEqual([
      "lead",
      "hurry",
      "move",
      "move",
      "hurry",
      "hurry",
      "move",
      "hurry",
      "move",
      "end",
    ]);
  });

  it("acts on the nearest thing, breathes in on a held act and lets go on release, practises, chooses and ends", () => {
    const heard: string[] = [];
    const earned: string[] = [];
    const play = startPlay({
      hero: "heerah",
      onEarned: (id) => earned.push(id),
      onNews: (news) => heard.push(news.kind),
      seed: 5,
    });
    // Mama starts by the tree: a hand on it wakes it.
    play.act(true);
    play.act(false);
    expect(play.state().touchedTree).toBe(true);
    expect(earned).toContain("first-touch");
    play.vision();
    expect(play.state().visionUses).toBe(1);
    expect(earned).toContain("savage-vision");
    // The breath, practised: held in for four counts and let go.
    play.practise(breathSkill);
    expect(play.state().moment?.kind).toBe("practice");
    play.act(true);
    expect(play.state().moment?.holding).toBe(play.state().tick);
    play.tick(120);
    play.act(false);
    expect(play.state().moment?.exhaleUntil).toBeGreaterThan(0);
    play.tick(200);
    expect(play.state().breaths).toBe(1);
    // A push held through a moment (three beats of the Cup) is walked once the moment is over.
    play.practise(-1);
    expect(play.state().moment?.skill).toBe(0);
    play.steer({ x: 1, y: 0 }, north);
    expect(play.state().moving).toBe(-1);
    play.choose(0);
    for (let beat = 0; beat < 3; beat += 1) {
      play.tick(45);
      play.act(true);
      play.act(false);
    }
    expect(play.state().moment).toBeNull();
    play.tick(1);
    expect(play.state().moving).toBe(4);
    play.end();
    expect(play.state().ended).toBe(true);
    play.tick(5);
    expect(heard).toEqual(
      expect.arrayContaining([
        "touch",
        "vision",
        "breath-in",
        "breath-out",
        "beat-perfect",
      ]),
    );
  });
});
