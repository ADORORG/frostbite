import { replayRecord } from "@frostbite/game-sdk/replay";
import {
  canonicalJson,
  maxRunRecordBytes,
  runRecordSchema,
} from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import { rules } from "../src/rules/index.ts";
import { milestones } from "../src/rules/milestones.ts";
import replayRules, { sample } from "../src/replay.ts";
import { sampleRun } from "../src/sample-run.ts";

describe("the run the verifier is published with", () => {
  it("is a valid record that replays to a win and exactly the milestones it claims", () => {
    const record = sampleRun();
    expect(runRecordSchema.parse(record)).toEqual(record);
    expect(new TextEncoder().encode(canonicalJson(record)).length).toBeLessThan(
      maxRunRecordBytes,
    );
    expect(replayRecord(rules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
    const ids = milestones.map(({ id }) => id);
    for (const claim of record.claims) expect(ids).toContain(claim);
    expect(record.claims).toContain("win-as-pip");
  });

  it("is published with the rules, under their own name, and ends the run", () => {
    expect(replayRules).toBe(rules);
    expect(sample()).toEqual(sampleRun());
    const record = sampleRun();
    expect(record.verifier).toBe(rules.id);
    expect(record.verifierVersion).toBe(rules.version);
    expect(record.inputs.at(-1)?.type).toBe("end");
  });
});
