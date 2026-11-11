import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { questRun } from "../src/page/quest-run.ts";
import type { Action } from "../src/page/hands.ts";
import { createQuestSession, type QuestSession } from "../src/quest-session.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { mostKeys, readKeys } from "../src/rules/quest/keys.ts";
import { legHolds, legShown } from "../src/rules/quest/legs.ts";
import { questDone } from "../src/rules/quest/tick.ts";
import { surface } from "./support/canvas.ts";
import { playHills } from "./support/hills-bot.ts";
import { change, playQuest } from "./support/quest-bot.ts";

// A seed on which a dragon that only runs right loses its three hearts in a few seconds.
const quickLoss = 6;
const seed = 20_261_031;
// The whole quest played well once, for every test that needs it (planning it takes a few seconds).
let played: QuestSession | null = null;
const wonQuest = (): QuestSession => (played ??= playQuest(seed));

describe("a quest as the player plays it", () => {
  it("can be won from Egg Hills to the woods, recorded compactly, and replayed by the published rules to the same marks", () => {
    const session = wonQuest();
    const state = session.state();
    expect(state.finishTick).not.toBeNull();
    expect(state.past.map(({ id }) => id)).toEqual(["hills", "castle"]);
    expect(state.leg.id).toBe("woods");
    const record = session.record();
    expect(record.config).toEqual({ cabinet: "quest" });
    expect(record.inputs.at(-1)).toEqual({
      data: { tick: state.tick },
      type: "end",
    });
    const batches = record.inputs.slice(0, -1);
    expect(batches.length).toBeGreaterThan(2);
    for (const input of batches) {
      expect(input.type).toBe("keys");
      const data = input.data;
      const keys = readKeys(
        typeof data === "object" && data !== null
          ? Object.fromEntries(Object.entries(data)).keys
          : undefined,
      );
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeLessThanOrEqual(mostKeys);
    }
    expect(JSON.stringify(record).length).toBeLessThan(65_536);
    expect(record.claims).toContain("quest-clear");
    expect(record.claims).toContain("hills-clear");
    expect(record.claims).toContain("guild-castle");
    expect(record.claims).toContain("woods-escape");
    expect(replayRecord(pocketDragonRules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
  }, 180_000);

  it("ignores what the level being played has no use for, closes when lost, and announces each mark once", () => {
    const heard: string[] = [];
    const session = createQuestSession({
      onEarned: (id) => heard.push(id),
      seed: quickLoss,
    });
    expect(session.hold("act", true)).toEqual({ ok: true });
    expect(session.hold("moon", true)).toEqual({ ok: true });
    expect(session.hold("right", false)).toEqual({ ok: true });
    session.hold("right", true);
    session.hold("right", true);
    for (let at = 0; at < 3_000 && !session.state().ended; at += 1)
      session.tick();
    expect(session.state().lost).toBe(true);
    expect(session.state().ended).toBe(true);
    session.tick();
    expect(session.hold("left", true)).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs).toEqual([
      { data: { keys: "0R" }, type: "keys" },
      { data: { tick: session.state().tick }, type: "end" },
    ]);
    expect(new Set(heard).size).toBe(heard.length);
    expect(session.record()).toEqual(record);
  });
});

// The hills bot's controls, as the page's actions.
const actionOf: Readonly<Record<string, Action>> = {
  fire: "fire",
  jump: "act",
  left: "left",
  right: "right",
};

describe("the quest's run on the page", () => {
  it("plays each level with its own meaning for the keys, shifts between them, and presses again what is still held", () => {
    const session = createQuestSession({ seed });
    const run = questRun(session);
    expect(run).toMatchObject({ id: "quest" });
    expect(run.level()).toBe("hills");
    expect(run.stats()).toEqual([
      ["Time", "0:00"],
      ["Hearts", "3"],
      ["Level", "1 of 3"],
    ]);
    expect([run.score(), run.won(), run.fame(), run.cleared()]).toEqual([
      0,
      false,
      null,
      [],
    ]);
    const heard: string[] = [];
    for (const input of playHills(seed).inputs) {
      const made = change(input);
      if (made === null) continue;
      while (session.state().tick < made.tick) heard.push(...run.tick());
      const action = actionOf[input.type];
      if (action !== undefined) run.hold(action, made.on);
    }
    while (session.state().shift === null) heard.push(...run.tick());
    expect(heard).toContain("stage");
    expect(run.cleared()).toEqual(["hills"]);
    for (let at = 0; at < 90; at += 1) run.tick();
    const screen = surface();
    run.draw(screen.context, false);
    expect(screen.texts()).toContain("A NEW DIMENSION!");
    // Held through the shift, right is pressed again when the castle begins.
    run.hold("right", true);
    let sounds: readonly string[] = [];
    while (session.state().shift !== null) sounds = run.tick();
    expect(sounds).toEqual(["start"]);
    expect(run.level()).toBe("castle");
    expect(legHolds(session.state().leg, "right")).toBe(true);
    for (let at = 0; at < 40; at += 1) run.tick();
    const castle = legShown(session.state().leg);
    expect(castle.id === "castle" && castle.state.x > 8).toBe(true);
    expect(run.stats()[2]).toEqual(["Level", "2 of 3"]);
    expect(run.score()).toBeGreaterThan(10_000);
    expect(run.plasma()).toBeGreaterThan(0);
    expect(run.earned()).toContain("hills-clear");
    run.hold("act", true);
    expect(legHolds(session.state().leg, "act")).toBe(true);
    expect(questDone(session.state())).toBe(false);
    expect(run.ended()).toBe(false);
  }, 180_000);

  it("is won with a place for the Hall of Fame", () => {
    const run = questRun(wonQuest());
    expect(run.won()).toBe(true);
    expect(run.cleared()).toEqual(["hills", "castle", "woods"]);
    // Clearing the first two stages of Egg Hills gives a heart each.
    expect(run.fame()).toMatchObject({
      hearts: 5,
      score: run.score(),
      ticks: expect.any(Number),
    });
    expect(run.fame()?.eggs).toBeGreaterThan(60);
    expect(run.tick()).toEqual([]);
  }, 180_000);
});
