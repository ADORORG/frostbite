import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { nightEggs } from "../src/rules/castle/places.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { legKinds, legRun } from "../src/rules/quest/legs.ts";
import { questEarned, questMilestones } from "../src/rules/quest/milestones.ts";
import { startQuest } from "../src/rules/quest/tick.ts";
import type { QuestState } from "../src/rules/quest/types.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { playHills } from "./support/hills-bot.ts";
import { playQuest } from "./support/quest-bot.ts";

const seed = 20_261_031;
const marks = (state: QuestState) =>
  questEarned(state).filter((id) => questMilestones.includes(id));

describe("the quest's marks for leaving nothing behind", () => {
  it("give every egg for a quest won with the golden eggs, the night's eggs and the maze's eggs, and the secret keeper for every secret area", () => {
    const saved = nightEggs.map(({ x, y }) => ({
      state: "saved" as const,
      x,
      y,
    }));
    const woods = startWoods(5);
    const quest = (
      goldens: number,
      eggs: typeof saved,
      found: boolean,
      secrets: number,
    ) => ({
      ...startQuest(5),
      finishTick: 20_000,
      leg: legRun(legKinds.woods, {
        ...woods,
        eggs: woods.eggs.map(() => found),
        escaped: true,
        outcome: "defused" as const,
      }),
      past: [
        legRun(legKinds.hills, {
          ...startHills(5),
          goldens,
          secretsFound: secrets,
        }),
        legRun(legKinds.castle, { ...startCastle(5), eggs }),
      ],
    });
    expect(marks(quest(3, saved, true, 6))).toEqual(
      expect.arrayContaining(["quest-all-eggs", "quest-all-secrets"]),
    );
    expect(marks(quest(2, saved, true, 5))).not.toEqual(
      expect.arrayContaining(["quest-all-eggs"]),
    );
    expect(marks(quest(2, saved, true, 5))).not.toContain("quest-all-secrets");
    expect(marks(quest(3, saved.slice(1), true, 6))).not.toContain(
      "quest-all-eggs",
    );
    expect(marks(quest(3, saved, false, 6))).not.toContain("quest-all-eggs");
    expect(marks({ ...quest(3, saved, true, 6), finishTick: null })).toEqual(
      [],
    );
  });
});

// The quest's marks for leaving nothing behind: a player who takes every treasure of the woods as well wins the whole quest with every
// egg; one who goes into Egg Hills' secret areas (`support/hills-detours.ts`) wins it having visited all six. Both are replayed.
describe("the whole quest played thoroughly", () => {
  it("gives every egg to a quest that leaves none behind, and the record replays to the same marks", () => {
    const session = playQuest(seed, 3, { thorough: true });
    expect(session.state().finishTick).not.toBeNull();
    const record = session.record();
    expect(record.claims).toContain("quest-all-eggs");
    expect(record.claims).not.toContain("quest-all-secrets");
    expect(replayRecord(pocketDragonRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
  }, 300_000);

  it("gives the secret keeper to a quest that goes into every one of Egg Hills' secret areas", () => {
    const explorer = playHills(seed, true);
    expect(explorer.state.secretsFound).toBe(6);
    expect(explorer.state.finishTick).not.toBeNull();
    const session = playQuest(seed, 3, { explore: true });
    expect(session.state().finishTick).not.toBeNull();
    const record = session.record();
    expect(record.claims).toContain("quest-all-secrets");
    expect(replayRecord(pocketDragonRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
  }, 300_000);
});
