import { describe, expect, it } from "vitest";

import { hillsPlay, woodsPlay } from "../src/chapters.ts";
import { createIdleRuns, startPlay } from "../src/page/plays.ts";
import { startHearts } from "../src/rules/constants.ts";
import {
  legHearts,
  legKinds,
  legLost,
  legRun,
  legShown,
  legTick,
  startLeg,
} from "../src/rules/quest/legs.ts";
import type { QuestState } from "../src/rules/quest/types.ts";
import { countdownLeft } from "../src/rules/woods/lair.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import type { WoodsState } from "../src/rules/woods/types.ts";
import { drawQuest } from "../src/screen/quest-draw.ts";
import { drawWoods } from "../src/screen/woods-screen.ts";
import {
  keepCountdown,
  keepHearts,
  keepLeg,
  lastTicks,
  rewind,
} from "../src/test-mode/keep.ts";
import { adminKey, keyMatches, keyText } from "../src/test-mode/key.ts";
import {
  createTestQuestSession,
  createTestSession,
} from "../src/test-mode/sessions.ts";
import { drawnWith } from "./support/drawn.ts";
import { baseOf, inLair } from "./support/woods-outside.ts";

// Key material made for these tests only (the key "GLITCHY2026"): the admin's own key is never in the code or the tests.
const testKey = {
  hash: "2fcc45910418227196463ecc7178834b561a3370d72ebc266a6e7a65846f8097",
  iterations: 1_000,
  salt: "00112233445566778899aabbccddeeff",
};
const subtle = globalThis.crypto.subtle;

describe("the admin's key", () => {
  it("unlocks only with the key itself, read in any case and with or without dashes, and never where it cannot be checked", async () => {
    expect(keyText(" glitchy-2026 ")).toBe("GLITCHY2026");
    expect(await keyMatches("GLITCHY2026", testKey, subtle)).toBe(true);
    expect(await keyMatches("glitchy-2026", testKey, subtle)).toBe(true);
    expect(await keyMatches("GLITCHY2027", testKey, subtle)).toBe(false);
    expect(await keyMatches("", testKey, subtle)).toBe(false);
    expect(await keyMatches("GLITCHY2026", testKey, null)).toBe(false);
    expect(
      await keyMatches("GLITCHY2026", { ...testKey, hash: "2f" }, subtle),
    ).toBe(false);
    expect(adminKey.iterations).toBeGreaterThanOrEqual(600_000);
    expect(adminKey.hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(adminKey.salt).toMatch(/^[0-9a-f]{32}$/u);
  });
});

describe("test runs", () => {
  it("give a lost heart back at once, never below the most the run has had", () => {
    const state = { hearts: 2, name: "any" };
    expect(keepHearts(state, 3)).toEqual({ hearts: 3, name: "any" });
    expect(keepHearts(state, 2)).toBe(state);
    expect(keepHearts({ hearts: 5 }, 3)).toEqual({ hearts: 5 });
  });

  it("wind DeFu's countdown back by whole rounds of her weapons before it runs out, and leave the woods alone otherwise", () => {
    expect(rewind % 300).toBe(0);
    expect(rewind % 420).toBe(0);
    const late = inLair({}, { tick: 7_200 - lastTicks });
    const wound = keepCountdown(late);
    expect(baseOf(wound).lairStart).toBe(rewind);
    expect(countdownLeft(baseOf(wound), wound.tick)).toBe(lastTicks + rewind);
    const early = inLair({}, { tick: 100 });
    expect(keepCountdown(early)).toBe(early);
    const beforeScene = inLair({ lairStart: 500 }, { tick: 100 });
    expect(keepCountdown(beforeScene)).toBe(beforeScene);
    expect(keepCountdown({ ...late, base: null })).toEqual({
      ...late,
      base: null,
    });
  });

  it("are a level played as it counts, but with nothing recorded or earned, every heart kept, and no end of time", () => {
    const session = createTestSession(hillsPlay, 6);
    session.hold("right", true);
    session.hold("right", true);
    session.hold("nothing", true);
    for (let at = 0; at < 600; at += 1) session.tick();
    const state = session.state();
    expect(state.heartsLost).toBeGreaterThan(0);
    expect(state.hearts).toBe(startHearts);
    expect(state.over).toBe(false);
    expect(session.earned()).toEqual([]);
    expect(session.record().inputs).toEqual([]);
    expect(session.record().claims).toEqual([]);
    const finished = { ...state, finishTick: state.tick };
    const ended = createTestSession({ ...hillsPlay, start: () => finished }, 6);
    ended.tick();
    expect(ended.state().ended).toBe(true);
    ended.tick();
    expect(ended.hold("left", true)).toEqual({ ok: true });
    const woods = createTestSession(woodsPlay, 3, keepCountdown);
    expect(woods.hold("up", true)).toEqual({ ok: true });
    woods.tick();
    expect(woods.state().tick).toBe(1);
    const done = createTestSession({ ...hillsPlay, start: () => finished }, 6);
    expect(done.hold("left", true)).toEqual({
      ok: false,
      reason: "the run is over",
    });
  });

  it("keep every level of the quest going: the castle's hearts, and the woods' hearts and countdown", () => {
    const castle = keepLeg(startLeg("castle", 3, 1), 4);
    expect(legHearts(castle)).toBe(4);
    const late = inLair({}, { hearts: 1, tick: 7_200 - lastTicks });
    const woods = keepLeg(legRun(legKinds.woods, late), 2);
    const shown = legShown(woods);
    expect(legHearts(woods)).toBe(2);
    expect(shown.id === "woods" && baseOf(shown.state).lairStart).toBe(rewind);
    expect(legLost(legRun(legKinds.woods, { ...late, tick: 60_000 }))).toBe(
      true,
    );
    expect(
      legLost(keepLeg(legRun(legKinds.woods, { ...late, tick: 60_000 }), 2)),
    ).toBe(false);
  });

  it("are the whole quest without a clock that ends a level, its hearts kept from level to level", () => {
    const session = createTestQuestSession(6);
    session.hold("right", true);
    session.hold("right", true);
    session.hold("show1", true);
    for (let at = 0; at < 600; at += 1) session.tick();
    const state = session.state();
    expect(legHearts(state.leg)).toBe(startHearts);
    expect(state.lost).toBe(false);
    expect(session.earned()).toEqual([]);
    expect(session.record().inputs).toEqual([]);
    expect(legShown(state.leg).id).toBe("hills");
    expect(legTick(state.leg)).toBe(600);
    const testDraw = (context: CanvasRenderingContext2D, now: QuestState) =>
      drawQuest(context, now, false, true);
    expect(drawnWith(drawQuest, state).texts()).toContain("0:10");
    expect(drawnWith(testDraw, state).texts()).not.toContain("0:10");
    const won = { ...state, finishTick: 600 };
    expect(drawnWith(testDraw, won).texts()).toContain(
      "A TEST RUN: NOTHING WAS COUNTED",
    );
    const maze = startWoods(3);
    const testWoods = (context: CanvasRenderingContext2D, now: WoodsState) =>
      drawWoods(context, now, false, true);
    expect(drawnWith(drawWoods, maze).texts()).toContain(
      "EGGS 0  PLASMA 0  MOONLIGHT 15:00",
    );
    expect(drawnWith(testWoods, maze).texts()).toContain("EGGS 0  PLASMA 0");
    // A press is taken as a run that counts takes it: a second one, or one while the dimension shifts, changes nothing.
    const held = session.state();
    expect(session.hold("right", true)).toEqual({ ok: true });
    expect(session.state()).toBe(held);
    const shifting = createTestQuestSession(6, {
      ...state,
      shift: { left: 10, to: "castle" },
    });
    const still = shifting.state();
    expect(shifting.hold("left", true)).toEqual({ ok: true });
    expect(shifting.state()).toBe(still);
    const woodsDone = {
      ...startWoods(6),
      escaped: true,
      outcome: "defused" as const,
    };
    const lastLeg = createTestQuestSession(6, {
      ...state,
      leg: legRun(legKinds.woods, woodsDone),
      past: [],
    });
    lastLeg.tick();
    expect(lastLeg.state()).toMatchObject({ ended: true });
    expect(lastLeg.state().finishTick).not.toBeNull();
    const ended = lastLeg.state();
    lastLeg.tick();
    expect(lastLeg.hold("left", true)).toEqual({ ok: true });
    expect(lastLeg.state()).toBe(ended);
  });

  it("are started as test runs by the page, and the screens before a run show the counts of one not yet begun", () => {
    for (const id of ["quest", "hills", "castle", "woods"] as const) {
      const run = startPlay(id, 9, undefined, true);
      expect(run.test).toBe(true);
      expect(run.earned()).toEqual([]);
      expect(startPlay(id, 9).test).toBe(false);
    }
    const idle = createIdleRuns();
    const quest = idle("quest");
    expect(quest.stats()[0]).toEqual(["Time", "0:00"]);
    expect(idle("quest")).toBe(quest);
    expect(quest.test).toBe(false);
  });
});
