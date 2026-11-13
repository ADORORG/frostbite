import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { createQuestSession } from "../src/quest-session.ts";
import { pocketDragonRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { questScore } from "../src/score.ts";

// A seed on which a dragon that only runs right loses its three hearts in a few seconds, which ends the quest quickly.
const quickLoss = 6;

function lostQuest() {
  const session = createQuestSession({ seed: quickLoss });
  session.hold("right", true);
  for (let at = 0; at < 3_000 && !session.state().ended; at += 1)
    session.tick();
  return session;
}

describe("the score the platform reads from a replay of the quest", () => {
  it("is the score the result card shows, once the quest has ended", () => {
    const session = lostQuest();
    const record = session.record();
    const shown = questScore(session.state());
    expect(session.state().ended).toBe(true);
    expect(Number.isSafeInteger(shown)).toBe(true);
    expect(replayRecord(pocketDragonRules, record)).toMatchObject({
      ok: true,
      score: shown,
    });
  });

  it("is none for a quest that was not closed", () => {
    const record = lostQuest().record();
    const open = { ...record, inputs: record.inputs.slice(0, -1) };
    expect(open.inputs.length).toBeGreaterThan(0);
    expect(replayRecord(pocketDragonRules, open)).toMatchObject({
      ok: true,
      score: null,
    });
  });

  it("is none for a level played alone, whose score would not rank against a quest's", () => {
    expect(replayRecord(pocketDragonRules, sampleRun())).toMatchObject({
      ok: true,
      score: null,
    });
  });
});
