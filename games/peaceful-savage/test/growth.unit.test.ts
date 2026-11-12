import { describe, expect, it } from "vitest";

import { targetOf } from "../src/rules/act.ts";
import {
  clues,
  clueSpot,
  mirrors,
  plasmaCount,
  plasmaSpots,
  relics,
} from "../src/rules/collect.ts";
import { breathInTicks, breathOutTicks } from "../src/rules/constants.ts";
import { wholeRoot } from "../src/rules/geometry.ts";
import { greyAt, greyHomes } from "../src/rules/greys.ts";
import {
  breathSkill,
  canRise,
  huddleSkill,
  levelAt,
  masteryLevel,
  moodOf,
  treePowerRest,
} from "../src/rules/growth.ts";
import { earnedBy } from "../src/rules/milestones.ts";
import { skillName, stepOf } from "../src/rules/moment.ts";
import { choiceIds } from "../src/rules/moments.ts";
import {
  goodWindow,
  knowledge,
  knowledgeCount,
  startRun,
  walkSpeed,
} from "../src/rules/state.ts";
import { advanceTo, plasmaAt } from "../src/rules/tick.ts";
import type { PlayState } from "../src/rules/types.ts";
import { accepted, led, refusal } from "./support/states.ts";

const breathe = (state: PlayState): PlayState => {
  const held = accepted(state, "act");
  const out = accepted(advanceTo(held, held.tick + breathInTicks), "release");
  return advanceTo(out, out.tick + breathOutTicks);
};
const onBeat = (state: PlayState): PlayState =>
  accepted(advanceTo(state, state.moment?.target ?? 0), "act");

describe("tiny plasma", () => {
  it("lies on open floor, twelve motes a room, chosen by the seed", () => {
    expect(plasmaCount).toBe(72);
    expect(plasmaSpots.every((spots) => spots.length >= 12)).toBe(true);
    expect(startRun(1).plasmaAt).not.toEqual(startRun(2).plasmaAt);
    expect(new Set(startRun(3).plasmaAt.slice(0, 12)).size).toBe(12);
  });

  it("is gathered by walking through it, for light and spark", () => {
    const state = led();
    const mote = plasmaAt(state, 12);
    const near = accepted({ ...state, x: mote.x - 60, z: mote.z }, "move", {
      way: 4,
    });
    const gathered = advanceTo(near, near.tick + 2);
    expect(gathered.plasma).toBe(1);
    expect(gathered.plasmaTaken[12]).toBe(true);
    expect(gathered.light).toBe(1);
    expect(gathered.news?.kind).toBe("plasma");
  });
});

describe("the spark", () => {
  it("is quieted near an unhealed grey one, even unseen, and warms with family", () => {
    const state = led({ tick: 29 });
    const home = greyHomes[0];
    const grey = state.greys[0];
    if (home === undefined || grey === undefined) throw new Error("no grey");
    const at = greyAt(home, grey.spot, grey.phase, 30);
    const near = advanceTo({ ...state, x: at.x + 500, z: at.z }, 30);
    expect(near.spark).toBe(58);
    const warm = advanceTo(
      led({ party: ["zora"], tick: 59, x: 0, z: 1_000 }),
      60,
    );
    expect(warm.spark).toBe(61);
  });

  it("dims the lead's gifts when low and brightens them when high", () => {
    expect(moodOf(led({ spark: 10 }))).toBe("dim");
    expect(moodOf(led({ spark: 50 }))).toBe("steady");
    expect(moodOf(led({ spark: 90 }))).toBe("bright");
    expect(goodWindow(led({ spark: 10 }))).toBeLessThan(
      goodWindow(led({ spark: 90 })),
    );
    expect(walkSpeed(led({ spark: 10 }))).toBeLessThan(walkSpeed(led()));
  });
});

describe("clues, relics and knowledge", () => {
  it("shows a clue only in Savage Vision, and then lets it be taken", () => {
    const clue = clues[1];
    if (clue === undefined) throw new Error("no clue");
    const state = led({ party: ["zora"], touchedTree: true });
    const at = clueSpot(clue, state.clueAt[1]);
    const there = { ...state, x: at.x + 200, z: at.z };
    expect(targetOf(there)).not.toEqual({ index: 1, kind: "clue" });
    const seen = accepted(there, "vision");
    expect(seen.cluesSeen[1]).toBe(true);
    const taken = accepted(seen, "act");
    expect(taken.cluesTaken[1]).toBe(true);
    expect(taken.light).toBe(5);
    expect(knowledge(taken)).toBe(1);
    expect(clueSpot(clue, 1)).toEqual(clue.spots[1]);
  });

  it("takes each relic once, for light and something true to know", () => {
    const relic = relics[3];
    if (relic === undefined) throw new Error("no relic");
    const taken = accepted(
      led({ party: ["ali"], x: relic.x + 200, z: relic.z }),
      "act",
    );
    expect(taken.relicsTaken[3]).toBe(true);
    expect(taken.light).toBe(8);
    expect(knowledgeCount).toBe(13);
    expect(earnedBy(taken)).toContain("first-relic");
  });
});

describe("mirrors and mirror force", () => {
  it("re-centres the lead after a breath and a look: full spark and a charge", () => {
    const mirror = mirrors[0];
    if (mirror === undefined) throw new Error("no mirror");
    const begun = accepted(
      led({ spark: 20, x: mirror.x - 300, z: mirror.z }),
      "act",
    );
    expect(begun.moment?.kind).toBe("mirror");
    const centre = breathe(begun);
    expect(stepOf(centre)?.kind).toBe("centre");
    const done = accepted(centre, "act");
    expect(done).toMatchObject({ mirrorForce: 1, spark: 100 });
    expect(done.light).toBe(6);
    expect(earnedBy(done)).toContain("mirror-force");
    const again = accepted(
      breathe(accepted({ ...done, spark: 50 }, "act")),
      "act",
    );
    expect(again.light).toBe(done.light);
    expect(again.mirrorForce).toBe(2);
  });

  it("turns a believed trick back on itself, and offers the choice again", () => {
    const begun = accepted(led({ mirrorForce: 1 }), "practice", { skill: 0 });
    const grey = {
      ...begun,
      moment: begun.moment && {
        ...begun.moment,
        arg: 0,
        kind: "grey" as const,
        skill: -1,
        step: 0,
      },
    };
    const truth = grey.answers[choiceIds.indexOf("grey-0")] ?? 0;
    const reflected = accepted(grey, "choose", { option: 1 - truth });
    expect(reflected).toMatchObject({ mirrorForce: 0, tricks: 0 });
    expect(reflected.moment?.kind).toBe("grey");
    expect(reflected.news?.kind).toBe("reflected");
  });
});

describe("practice and mastery", () => {
  it("practises a hand-key in three beats, growing its mastery and the lead's light", () => {
    let state = accepted(led(), "practice", { skill: 2 });
    expect(refusal(state, "practice", { skill: 1 })).toBe("a moment is going");
    for (let beat = 0; beat < 3; beat += 1) state = onBeat(state);
    expect(state.moment).toBeNull();
    expect(state.mastery[2]).toBe(6);
    expect(state.light).toBe(6);
    expect(masteryLevel(6)).toBe(1);
    expect(masteryLevel(15)).toBe(3);
  });

  it("masters a key at fifteen, says so, and gives it more give on the beat", () => {
    let state = accepted(
      led({ mastery: [12, 0, 0, 0, 0, 0, 0, 0] }),
      "practice",
      { skill: 0 },
    );
    state = onBeat(onBeat(state));
    expect(state.news).toMatchObject({ detail: "0", kind: "mastered" });
    expect(goodWindow(state, "cup")).toBe(goodWindow(state, "comb") + 2);
    expect(earnedBy(state)).toContain("master-key");
    expect(skillName(0)).toBe("cup");
    expect(skillName(breathSkill)).toBe("breath");
    expect(skillName(99)).toBe("");
  });

  it("practises the breath, and the huddle only with family", () => {
    const breath = breathe(accepted(led(), "practice", { skill: breathSkill }));
    expect(breath.mastery[breathSkill]).toBe(5);
    expect(breath.light).toBe(3);
    expect(refusal(led(), "practice", { skill: huddleSkill })).toBe(
      "a huddle needs family to huddle with",
    );
    expect(refusal(led(), "practice", { skill: 8 })).toBe("a skill is 0 to 7");
    let huddle = accepted(led({ party: ["zora"] }), "practice", {
      skill: huddleSkill,
    });
    expect(stepOf(huddle)?.kind).toBe("huddle");
    huddle = breathe(onBeat(accepted(huddle, "act")));
    expect(huddle.mastery[huddleSkill]).toBe(7);
  });
});

describe("levels and the tree's power", () => {
  it("raises the lead one level a touch once their light is enough", () => {
    const tree = { x: 0, z: 4_600 };
    const ready = led({ ...tree, light: levelAt[2] ?? 0, touchedTree: true });
    expect(canRise(ready)).toBe(true);
    const once = accepted(ready, "act");
    expect(once.level).toBe(2);
    const twice = accepted(once, "act");
    expect(twice.level).toBe(3);
    expect(accepted(twice, "act").level).toBe(3);
    expect(earnedBy(twice)).toContain("level-3");
  });

  it("powers the lead up once it has recovered, then rests", () => {
    const recovered = led({
      greys: startRun(11).greys.map((grey, index) => ({
        ...grey,
        healed: index < 3,
      })),
      spark: 30,
      touchedTree: true,
      x: 0,
      z: 4_600,
    });
    const powered = accepted(recovered, "act");
    expect(powered).toMatchObject({
      mirrorForce: 1,
      spark: 70,
      treeReady: treePowerRest,
    });
    expect(powered.news?.kind).toBe("power");
    expect(accepted(powered, "act").news).toMatchObject({
      detail: "again",
      kind: "touch",
    });
  });

  it("takes whole square roots the same way everywhere", () => {
    expect([0, 1, 2, 15, 16, 17, 1_000_000].map(wholeRoot)).toEqual([
      0, 1, 1, 3, 4, 4, 1_000,
    ]);
  });
});
