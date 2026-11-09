import { describe, expect, it } from "vitest";

import { targetOf } from "../src/rules/act.ts";
import { breathInTicks, breathOutTicks } from "../src/rules/constants.ts";
import { bloomed, planted, sproutTicks } from "../src/rules/garden.ts";
import { greyAt, greyHomes } from "../src/rules/greys.ts";
import { greyLimit } from "../src/rules/greying.ts";
import { sparkDim } from "../src/rules/growth.ts";
import { gardenBeds, places } from "../src/rules/layout.ts";
import { earnedBy } from "../src/rules/milestones.ts";
import { beginMoment, stepOf } from "../src/rules/moment.ts";
import { choiceIds, script } from "../src/rules/moments.ts";
import { advanceTo } from "../src/rules/tick.ts";
import type { PlayState } from "../src/rules/types.ts";
import { accepted, led } from "./support/states.ts";

const at = (state: PlayState, point: { x: number; z: number }): PlayState => ({
  ...state,
  x: point.x,
  z: point.z + 600,
});

// Plays the moment the lead is in to its end: each beat on its mark, each breath held four counts and let go, each choice true.
function playThrough(state: PlayState): PlayState {
  let now = state;
  for (let guard = 0; guard < 20 && now.moment !== null; guard += 1) {
    const step = stepOf(now);
    const moment = now.moment;
    if (step === null || moment === null) break;
    if (step.kind === "beat") {
      now = accepted(advanceTo(now, moment.target), "act");
    } else if (step.kind === "breath") {
      now = accepted(now, "act");
      now = accepted(advanceTo(now, now.tick + breathInTicks), "release");
      now = advanceTo(now, now.tick + breathOutTicks + 1);
    } else if (step.kind === "choose") {
      const truth = now.answers[choiceIds.indexOf(step.choice)] ?? 0;
      now = accepted(now, "choose", { option: truth });
    } else now = accepted(now, "act");
  }
  return now;
}

describe("Zora's lesson: love the land, plant it and tend it", () => {
  it("has no garden to plant until Zora is with the family", () => {
    const alone = at(led(), gardenBeds[0] ?? places.hill);
    expect(targetOf(alone)).not.toMatchObject({ kind: "bed" });
    const withZora = at(led({ lead: "zora" }), gardenBeds[0] ?? places.hill);
    expect(targetOf(withZora)).toEqual({ index: 0, kind: "bed" });
  });

  it("plants a bed, lets it sprout, then tends it into bloom, and with all three in bloom the garden is done", () => {
    let state = led({ lead: "zora" });
    gardenBeds.forEach((bed, index) => {
      state = accepted(at(state, bed), "act");
      expect(state.garden[index]).toBe(planted);
      expect(state.news?.kind).toBe("planted");
      expect(targetOf(state)).not.toMatchObject({ index, kind: "bed" });
    });
    state = advanceTo(state, state.tick + sproutTicks);
    const meadow = state.colour[0] ?? 0;
    const spark = state.spark;
    gardenBeds.forEach((bed, index) => {
      state = at(state, bed);
      expect(targetOf(state)).toEqual({ index, kind: "bed" });
      state = accepted(state, "act");
      expect(state.garden[index]).toBe(bloomed);
      expect(state.news?.kind).toBe("bloomed");
    });
    expect(state.colour[0]).toBe(meadow + 24);
    expect(state.spark).toBeGreaterThan(spark);
    expect(earnedBy(state)).toContain("the-garden");
    expect(earnedBy(led())).not.toContain("the-garden");
  });
});

describe("Kai's lesson: build it again, a step at a time, with a breath in the middle", () => {
  it("builds the tower on his bench once Kai is with the family: base, frame, a breath, the spire", () => {
    expect(script("build").map((step) => step.kind)).toEqual([
      "beat",
      "beat",
      "breath",
      "beat",
    ]);
    expect(script("kai").map((step) => step.kind)).toEqual([
      "beat",
      "beat",
      "breath",
      "choose",
    ]);
    expect(targetOf(at(led({ lead: "zora" }), places.bench))).not.toEqual({
      id: "bench",
      kind: "story",
    });
    const bench = at(led({ lead: "kai" }), places.bench);
    expect(targetOf(bench)).toEqual({ id: "bench", kind: "story" });
    const building = accepted(bench, "act");
    expect(building.moment?.kind).toBe("build");
    const built = playThrough(building);
    expect(built.tower).toBe(true);
    expect(built.news?.kind).toBe("tower");
    expect(earnedBy(built)).toContain("the-tower");
    expect(targetOf(built)).toBeNull();
  });
});

describe("Mama's gift: she senses what is near", () => {
  it("sees a sly snake close by without vision while she is with the family, and only then", () => {
    const home = greyHomes[0];
    const base = led();
    const grey = base.greys[0];
    if (home === undefined || grey === undefined) throw new Error("no grey");
    const where = greyAt(home, grey.spot, grey.phase, base.tick + 1);
    const near = { ...base, x: where.x + 1_000, z: where.z };
    const without = advanceTo(near, near.tick + 1);
    expect(without.greys[0]?.seen).toBe(false);
    const sensed = advanceTo({ ...near, party: ["heerah"] }, near.tick + 1);
    expect(sensed.greys[0]?.seen).toBe(true);
    expect(sensed.news?.kind).toBe("sensed");
    const leading = advanceTo({ ...near, lead: "heerah" }, near.tick + 1);
    expect(leading.greys[0]?.seen).toBe(true);
  });
});

describe("poor choices", () => {
  const asked = (overrides: Partial<PlayState>): PlayState =>
    beginMoment(led(overrides), "grey", 1);
  const trickOf = (state: PlayState): number =>
    1 - (state.answers[choiceIds.indexOf("grey-1")] ?? 0);

  it("grey the lead a step when a trick is believed with the spark already low, and at three steps the snakes take them", () => {
    const high = asked({ spark: 80 });
    expect(accepted(high, "choose", { option: trickOf(high) }).greyed).toBe(0);
    let state = asked({ spark: sparkDim - 1 });
    state = accepted(state, "choose", { option: trickOf(state) });
    expect(state.greyed).toBe(1);
    expect(state.news).toMatchObject({ detail: "1", kind: "greying" });
    expect(state.ended).toBe(false);
    state = asked({ greyed: greyLimit - 1, spark: 5 });
    state = accepted(state, "choose", { option: trickOf(state) });
    expect(state.ended).toBe(true);
    expect(state.cause).toBe("grey");
    expect(state.news?.kind).toBe("joined");
    expect(earnedBy(state).some((id) => id.startsWith("light-as"))).toBe(false);
  });

  it("bring a step of colour back for each true answer and whole breath, and all of it at a mirror", () => {
    const truthful = asked({ greyed: 2, spark: 10 });
    const truth = 1 - trickOf(truthful);
    expect(accepted(truthful, "choose", { option: truth }).greyed).toBe(1);
    const breathing = beginMoment(led({ greyed: 2 }), "practice", 6);
    expect(playThrough(breathing).greyed).toBe(1);
    const mirror = playThrough(beginMoment(led({ greyed: 2 }), "mirror", 0));
    expect(mirror.greyed).toBe(0);
    expect(playThrough(beginMoment(led(), "practice", 6)).greyed).toBe(0);
  });
});
