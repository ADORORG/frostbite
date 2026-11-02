import { describe, expect, it } from "vitest";

import { startCastle } from "../src/rules/castle/tick.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import {
  maxTicks,
  shiftTicks,
  swiftTicks,
} from "../src/rules/quest/constants.ts";
import { questRules } from "../src/rules/quest/index.ts";
import {
  controlNamed,
  letterOf,
  mostKeys,
  readKeys,
} from "../src/rules/quest/keys.ts";
import {
  legHearts,
  legHolds,
  legKinds,
  legRun,
  legShown,
  legTick,
  legUses,
  startLeg,
} from "../src/rules/quest/legs.ts";
import { questEarned, questMilestones } from "../src/rules/quest/milestones.ts";
import {
  advanceQuest,
  questChange,
  questDone,
  startQuest,
  tickQuest,
} from "../src/rules/quest/tick.ts";
import type { QuestState } from "../src/rules/quest/types.ts";
import { startWoods } from "../src/rules/woods/index.ts";

const step = (state: QuestState, type: string, data: unknown) => {
  const stepped = questRules.step(state, {
    data: data as never,
    type,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};
const refused = (state: QuestState, type: string, data: unknown) => {
  const stepped = questRules.step(state, { data: data as never, type });
  return stepped.ok ? "taken" : stepped.reason;
};

// A quest in a given level, as if it had just got there.
const inLevel = (state: QuestState, leg: QuestState["leg"]): QuestState => ({
  ...state,
  leg,
});

describe("the quest's compact presses", () => {
  it("read as ticks since the change before and a letter, a capital for a press", () => {
    expect(readKeys("12R30r0J")).toEqual([
      { control: "right", gap: 12, on: true },
      { control: "right", gap: 30, on: false },
      { control: "jump", gap: 0, on: true },
    ]);
    expect(readKeys("0V5z")).toEqual([
      { control: "show1", gap: 0, on: true },
      { control: "show5", gap: 5, on: false },
    ]);
    expect(letterOf("right", true)).toBe("R");
    expect(letterOf("skip", false)).toBe("k");
    expect(letterOf("moon", true)).toBeUndefined();
    expect(controlNamed("show3")).toBe("show3");
    expect(controlNamed("x")).toBeUndefined();
  });

  it("refuse anything else: no letter, an unknown letter, a gap too long, too many changes, or not a string", () => {
    for (const bad of ["", "R", "12", "12R3", "1234567R", "12#", "4b", " 1R"])
      expect(typeof readKeys(bad)).toBe("string");
    expect(readKeys("4b")).toBe("no control is written b");
    expect(readKeys(7)).toBe("keys must be ticks and letters, like 12R30r");
    expect(readKeys("1R1r".repeat(mostKeys / 2))).toHaveLength(mostKeys);
    expect(readKeys("1R1r".repeat(mostKeys / 2 + 1))).toBe(
      `one input holds at most ${String(mostKeys)} changes`,
    );
  });
});

describe("the quest", () => {
  it("begins in Egg Hills with three hearts, as one cabinet of the one verifier", () => {
    const quest = startQuest(5);
    expect(quest.leg.id).toBe("hills");
    expect(legHearts(quest.leg)).toBe(3);
    expect(legShown(quest.leg)).toEqual({ id: "hills", state: startHills(5) });
    expect(quest).toMatchObject({ lost: false, shift: null, tick: 0 });
    expect(questRules.init(5, {})).toEqual({
      ok: true,
      state: expect.anything(),
    });
    expect(pocketDragonRules.init(5, { cabinet: "quest" }).ok).toBe(true);
    expect(maxTicks).toBe(21_600 + 54_000 + 54_000 + 2 * shiftTicks);
  });

  it("shifts into the next dimension when a level is cleared, and starts it with the hearts the last ended with", () => {
    const cleared = inLevel(
      startQuest(5),
      legRun(legKinds.hills, {
        ...startHills(5),
        finishTick: 0,
        hearts: 2,
        heartsLost: 1,
      }),
    );
    const shifting = tickQuest(cleared);
    expect(shifting.shift).toEqual({ left: shiftTicks, to: "castle" });
    expect(shifting.leg.id).toBe("hills");
    // Nothing is taken while the dimension shifts.
    expect(questChange(shifting, "right", true)).toEqual({
      ok: false,
      reason: "the dimension is shifting",
    });
    const arrived = advanceQuest(shifting, shifting.tick + shiftTicks);
    expect(arrived.shift).toBeNull();
    expect(arrived.past.map(({ id }) => id)).toEqual(["hills"]);
    expect(arrived.leg.id).toBe("castle");
    expect(legTick(arrived.leg)).toBe(0);
    expect(legHearts(arrived.leg)).toBe(2);
    expect(legShown(arrived.leg)).toEqual({
      id: "castle",
      state: startCastle(5, 2),
    });
    expect(tickQuest(arrived).tick).toBe(arrived.tick + 1);
    expect(legTick(tickQuest(arrived).leg)).toBe(1);
  });

  it("is won when the last level is cleared, and lost when a level runs out of hearts or of time", () => {
    const woods = startWoods(5);
    const won = tickQuest(
      inLevel(
        startQuest(5),
        legRun(legKinds.woods, {
          ...woods,
          escaped: true,
          outcome: "defused",
        }),
      ),
    );
    expect(won.finishTick).toBe(1);
    expect(questDone(won)).toBe(true);
    const out = tickQuest(
      inLevel(
        startQuest(5),
        legRun(legKinds.hills, { ...startHills(5), over: true }),
      ),
    );
    expect(out.lost).toBe(true);
    const late = tickQuest(
      inLevel(
        startQuest(5),
        legRun(legKinds.castle, { ...startCastle(5), tick: 54_000 - 1 }),
      ),
    );
    expect(late.lost).toBe(true);
    const tired = tickQuest(
      inLevel(startQuest(5), legRun(legKinds.woods, { ...woods, hearts: 0 })),
    );
    expect(tired.lost).toBe(true);
    // Once over, the quest only counts on.
    expect(tickQuest(out)).toEqual({ ...out, tick: out.tick + 1 });
    expect(questChange(out, "right", true)).toEqual({
      ok: false,
      reason: "the run is over",
    });
  });

  it("takes a press only in a level that has that control, and not twice", () => {
    const quest = startQuest(5);
    const pressed = questChange(quest, "jump", true);
    if (!pressed.ok) throw new Error(pressed.reason);
    expect(legHolds(pressed.state.leg, "jump")).toBe(true);
    expect(questChange(pressed.state, "jump", true)).toEqual({
      ok: false,
      reason: "jump is already held",
    });
    expect(questChange(quest, "act", true)).toEqual({
      ok: false,
      reason: "hills has no control called act",
    });
    const castle = inLevel(quest, startLeg("castle", 5, 3));
    expect(legUses(castle.leg, "act")).toBe(true);
    expect(legUses(castle.leg, "jump")).toBe(false);
    expect(legHolds(castle.leg, "moon")).toBe(false);
  });
});

describe("the quest's record", () => {
  it("takes many presses in one input, each on its own tick, and is closed by end", () => {
    const quest = step(startQuest(5), "keys", { keys: "10R20r0J" });
    expect(quest.tick).toBe(30);
    expect(legHolds(quest.leg, "right")).toBe(false);
    expect(legHolds(quest.leg, "jump")).toBe(true);
    expect(legShown(quest.leg).state.tick).toBe(30);
    const ended = step(quest, "end", { tick: 90 });
    expect(ended).toMatchObject({ ended: true, tick: 90 });
    expect(refused(ended, "keys", { keys: "1R" })).toBe("the run has ended");
  });

  it("refuses what the quest cannot take", () => {
    const quest = startQuest(5);
    expect(refused(quest, "jump", { on: 1, tick: 0 })).toBe(
      "no such input: jump",
    );
    expect(refused(quest, "keys", { keys: "1#" })).toBe(
      "keys must be ticks and letters, like 12R30r",
    );
    expect(refused(quest, "keys", { keys: "1R", tick: 3 })).toBe(
      "the input takes exactly: keys",
    );
    expect(refused(quest, "keys", { keys: "1A" })).toBe(
      "hills has no control called act",
    );
    expect(refused(quest, "keys", { keys: "1R0R" })).toBe(
      "right is already held",
    );
    expect(refused(quest, "keys", { keys: `${String(maxTicks + 1)}R` })).toBe(
      `tick must be from 0 to ${String(maxTicks)}`,
    );
    expect(refused(quest, "end", { tick: maxTicks + 1 })).toBe(
      `tick must be from 0 to ${String(maxTicks)}`,
    );
    expect(refused(quest, "end", {})).toBe("the input takes exactly: tick");
  });
});

describe("the quest's marks", () => {
  const won = (hearts: number, heartsLost: number, finishTick: number) => {
    const last = legRun(legKinds.woods, {
      ...startWoods(5),
      escaped: true,
      hearts,
      heartsLost,
    });
    return {
      ...startQuest(5),
      finishTick,
      leg: last,
      past: [
        legRun(legKinds.hills, { ...startHills(5), eggsBanked: 3 }),
        legRun(legKinds.castle, startCastle(5)),
      ],
    };
  };
  const marks = (state: QuestState) =>
    questEarned(state).filter((id) => questMilestones.includes(id));

  it("are every level's marks on the way, and the quest's own for a win", () => {
    expect(questEarned(startQuest(5))).toEqual([]);
    expect(questEarned(won(3, 0, 20_000))).toContain("first-egg");
    expect(marks(won(3, 0, 20_000))).toEqual([
      "quest-clear",
      "quest-all-hearts",
      "quest-swift",
    ]);
    expect(marks(won(1, 2, swiftTicks + 1))).toEqual([
      "quest-clear",
      "quest-one-heart",
    ]);
    expect(marks({ ...won(3, 0, 20_000), finishTick: null })).toEqual([]);
    expect(questMilestones).toEqual([
      "quest-clear",
      "quest-all-hearts",
      "quest-one-heart",
      "quest-swift",
    ]);
  });
});
