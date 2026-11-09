import { describe, expect, it } from "vitest";

import { targetOf } from "../src/rules/act.ts";
import {
  beatLead,
  breathInTicks,
  breathOutTicks,
} from "../src/rules/constants.ts";
import { greyAt, greyHomes } from "../src/rules/greys.ts";
import { familySpots, places } from "../src/rules/layout.ts";
import { earnedBy } from "../src/rules/milestones.ts";
import {
  beginMoment,
  isHero,
  momentTick,
  stepOf,
} from "../src/rules/moment.ts";
import { choiceIds, momentKinds, script } from "../src/rules/moments.ts";
import { advanceTo } from "../src/rules/tick.ts";
import type { PlayState } from "../src/rules/types.ts";
import { accepted, led, refusal } from "./support/states.ts";

const truthOf = (state: PlayState): number => {
  const step = stepOf(state);
  return step?.kind === "choose"
    ? (state.answers[choiceIds.indexOf(step.choice)] ?? 0)
    : 0;
};
const onBeat = (state: PlayState, off = 0) => {
  const target = state.moment?.target ?? 0;
  return accepted(advanceTo(state, target + off), "act");
};

describe("beats", () => {
  const forge = () => beginMoment(led({ touchedTree: true }), "forge");

  it("lands a press on the beat as perfect, a little off as good, and far off as a miss that sets the beat again", () => {
    const perfect = onBeat(forge());
    expect(perfect.beatsPerfect).toBe(1);
    expect(perfect.moment?.step).toBe(1);
    const good = onBeat(forge(), 6);
    expect(good.beatsGood).toBe(1);
    const early = accepted(forge(), "act");
    expect(early.beatsMissed).toBe(1);
    expect(early.moment?.target).toBe(early.tick + beatLead);
    expect(early.moment?.step).toBe(0);
  });

  it("misses a beat let pass, and sets it again", () => {
    const state = forge();
    const passed = advanceTo(state, (state.moment?.target ?? 0) + 40);
    expect(passed.beatsMissed).toBe(1);
    expect(passed.news?.kind).toBe("beat-miss");
  });

  it("forges Sparky after three beats, and opens the front door", () => {
    let state = forge();
    for (let at = 0; at < 3; at += 1) state = onBeat(state);
    expect(state.sparky).toBe(true);
    expect(state.moment).toBeNull();
    expect(state.news?.kind).toBe("sparky");
    expect(refusal(state, "release")).toBe("no breath is being held");
  });

  it("gives Kai, who locks in the groove, one tick more for a perfect beat", () => {
    const kai = onBeat(beginMoment(led({ lead: "kai" }), "drawer"), 4);
    const zora = onBeat(beginMoment(led({ lead: "zora" }), "drawer"), 4);
    expect(kai.beatsPerfect).toBe(1);
    expect(zora.beatsGood).toBe(1);
  });
});

describe("breaths", () => {
  const breathing = () => beginMoment(led({ lead: "heerah" }), "heerah");

  it("takes a breath in held for about four counts, then counts six out", () => {
    const held = accepted(breathing(), "act");
    expect(held.moment?.holding).toBe(held.tick);
    expect(refusal(held, "act")).toBe("a breath is already going");
    const out = accepted(advanceTo(held, held.tick + breathInTicks), "release");
    expect(out.moment?.exhaleUntil).toBe(out.tick + breathOutTicks);
    const done = advanceTo(out, out.tick + breathOutTicks);
    expect(done.breaths).toBe(1);
    expect(stepOf(done)?.kind).toBe("choose");
    expect(earnedBy(done)).toContain("first-breath");
  });

  it("begins again after a breath let go too soon, or held far too long", () => {
    const held = accepted(breathing(), "act");
    const short = accepted(advanceTo(held, held.tick + 30), "release");
    expect(short.news?.kind).toBe("breath-miss");
    expect(short.moment?.holding).toBe(-1);
    const long = advanceTo(held, held.tick + breathInTicks + 200);
    expect(long.moment?.holding).toBe(-1);
    expect(refusal(long, "release")).toBe("no breath is being held");
  });
});

describe("choices and leaning in", () => {
  it("carries a moment on with the true answer, and holds it on a trick", () => {
    const begun = beginMoment(led(), "heerah");
    if (begun.moment === null) throw new Error("no moment");
    const state: PlayState = { ...begun, moment: { ...begun.moment, step: 1 } };
    const truth = truthOf(state);
    const tricked = accepted(state, "choose", { option: 1 - truth });
    expect(tricked.tricks).toBe(1);
    expect(tricked.moment?.step).toBe(1);
    const found = accepted(tricked, "choose", { option: truth });
    expect(found.party).toEqual(["heerah"]);
    expect(found.moment).toBeNull();
    expect(refusal(found, "choose", { option: 0 })).toBe(
      "there is nothing to choose",
    );
    expect(refusal(state, "choose", { option: 2 })).toBe("an option is 0 or 1");
    expect(refusal(state, "choose", { option: "yes" })).toBe(
      "an option is a number",
    );
    expect(refusal(state, "act")).toBe("this step is a choice");
  });

  it("leans in beside Daddy before anything else, and stops the lead walking in a moment", () => {
    const sitting = beginMoment(led({ moving: 4 }), "ali");
    expect(sitting.moving).toBe(-1);
    expect(stepOf(sitting)?.kind).toBe("lean");
    expect(refusal(sitting, "move", { way: 2 })).toBe(
      "the lead cannot walk off in a moment",
    );
    expect(refusal(sitting, "vision")).not.toBe("");
    expect(accepted(sitting, "act").moment?.step).toBe(1);
  });

  it("knows which moments are a family member's", () => {
    expect(momentKinds.filter(isHero)).toEqual([
      "kai",
      "zora",
      "heerah",
      "ali",
    ]);
    expect(script("grey", 9)).toEqual([{ choice: "grey-0", kind: "choose" }]);
    expect(momentTick(led())).toEqual(led());
  });
});

describe("the grey ones and their threads", () => {
  const seenAt = (index: number) => {
    const state = led({ party: ["zora", "heerah", "ali"], touchedTree: true });
    const grey = state.greys[index];
    const home = greyHomes[index];
    if (grey === undefined || home === undefined) throw new Error("no grey");
    const at = greyAt(home, grey.spot, grey.phase, 0);
    return {
      at,
      state: {
        ...state,
        greys: state.greys.map((each, i) =>
          i === index ? { ...each, seen: true } : each,
        ),
        x: at.x + 300,
        z: at.z,
      },
    };
  };

  it("are only seen in Savage Vision, which rests between uses", () => {
    const state = led({ touchedTree: false });
    expect(refusal(state, "vision")).toBe("the tree has not given vision yet");
    const home = greyHomes[0];
    const grey = state.greys[0];
    if (home === undefined || grey === undefined) throw new Error("no grey");
    const at = greyAt(home, grey.spot, grey.phase, 0);
    const opened = accepted(
      { ...state, touchedTree: true, x: at.x, z: at.z + 1_000 },
      "vision",
    );
    expect(opened.greys[0]?.seen).toBe(true);
    expect(refusal(opened, "vision")).toBe("vision is resting");
    const walked = advanceTo(
      accepted(
        { ...opened, greys: opened.greys.map((g) => ({ ...g, seen: false })) },
        "move",
        { way: 8 },
      ),
      opened.tick + 20,
    );
    expect(walked.greys.some((g) => g.seen)).toBe(true);
  });

  it("is healed by the true answer, and drops its thread to be picked up", () => {
    const { state } = seenAt(1);
    const talking = accepted(state, "act");
    expect(talking.moment?.kind).toBe("grey");
    const healed = accepted(talking, "choose", { option: truthOf(talking) });
    expect(healed.greys[1]).toMatchObject({ healed: true, thread: 1 });
    expect(healed.score).toBe(150);
    const picked = accepted(
      {
        ...healed,
        x: healed.greys[1]?.dropX ?? 0,
        z: (healed.greys[1]?.dropZ ?? 0) + 200,
      },
      "act",
    );
    expect(picked.threads).toBe(1);
    expect(picked.greys[1]?.thread).toBe(2);
    expect(earnedBy(picked)).toContain("first-healed");
  });

  it("slips away to its next place when its trick is believed", () => {
    const { state } = seenAt(2);
    const talking = accepted(state, "act");
    const fooled = accepted(talking, "choose", {
      option: 1 - truthOf(talking),
    });
    expect(fooled.moment).toBeNull();
    expect(fooled.greys[2]?.spot).toBe(((state.greys[2]?.spot ?? 0) + 1) % 3);
    expect(fooled.greyTricks).toBe(1);
  });
});

describe("the jackets, the drawer and the hill", () => {
  it("weaves the jackets only with all six threads and Mama Heerah", () => {
    const at = { x: places.loom.x, z: places.loom.z - 700 };
    expect(targetOf(led({ ...at, threads: 6 }))).not.toEqual({
      id: "loom",
      kind: "story",
    });
    expect(targetOf(led({ ...at, party: ["heerah"], threads: 5 }))).not.toEqual(
      { id: "loom", kind: "story" },
    );
    let state = accepted(led({ ...at, party: ["heerah"], threads: 6 }), "act");
    for (let beat = 0; beat < 3; beat += 1) state = onBeat(state);
    expect(state.jackets).toBe(true);
    expect(state.colour.every((value) => value >= 28)).toBe(true);
  });

  it("opens the drawer for Daddy's knock", () => {
    const at = { x: places.drawer.x, z: places.drawer.z + 300 };
    expect(targetOf(led(at))).not.toEqual({ id: "drawer", kind: "story" });
    let state = accepted(led({ ...at, lead: "ali" }), "act");
    for (let beat = 0; beat < 2; beat += 1) state = onBeat(state);
    expect(state.drawer).toBe(true);
  });

  it("calls the whole family to the hill once the jackets are on, and lights the tree at the end", () => {
    const family = {
      jackets: true,
      lead: "kai" as const,
      mastery: [0, 0, 0, 0, 0, 0, 0, 15],
      party: ["zora", "heerah", "ali"] as const,
      sparky: true,
    };
    const walking = accepted(
      led({ ...family, party: [...family.party], x: 0, z: -14_000 }),
      "move",
      { way: 8 },
    );
    expect(walking.moment).toBeNull();
    const called = accepted(
      led({ ...family, party: [...family.party], x: 0, z: -14_600 }),
      "move",
      { way: 8 },
    );
    const risen = advanceTo(called, called.tick + 5);
    expect(risen.moment?.kind).toBe("finale");
    let state = risen;
    for (let guard = 0; guard < 20 && !state.ended; guard += 1) {
      const step = stepOf(state);
      if (step?.kind === "choose")
        state = accepted(state, "choose", { option: truthOf(state) });
      else if (step?.kind === "breath") {
        state = accepted(state, "act");
        state = accepted(
          advanceTo(state, state.tick + breathInTicks),
          "release",
        );
        state = advanceTo(state, state.tick + breathOutTicks);
      } else state = onBeat(state);
    }
    expect(state.cause).toBe("lit");
    expect(state.colour.every((value) => value === 100)).toBe(true);
    expect(state.finalePerfect).toBe(6);
    expect(earnedBy(state)).toEqual(
      expect.arrayContaining(["perfect-six", "light-as-kai"]),
    );
    expect(familySpots.kai).toEqual({ x: -2_700, z: -1_800 });
  });
});
