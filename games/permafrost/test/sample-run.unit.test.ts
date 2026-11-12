import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { permafrostRules } from "../src/rules/index.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { sampleRun } from "../src/sample-run.ts";

describe("the run the verifier is shown with", () => {
  it("is legal, and earns exactly the milestones it claims, every one of them a real milestone", () => {
    const record = sampleRun();
    expect(replayRecord(permafrostRules, record)).toMatchObject({
      earned: record.claims,
      ok: true,
    });
    for (const claim of record.claims) expect(milestoneIds).toContain(claim);
    expect(record.claims.length).toBeGreaterThanOrEqual(5);
  });

  it("is a plain record, with the rules' own names, and ends the run", () => {
    const record = sampleRun();
    expect(record.verifier).toBe(permafrostRules.id);
    expect(record.verifierVersion).toBe(permafrostRules.version);
    expect(record.inputs.at(-1)?.type).toBe("end");
  });

  it("is small, so the published verifier stays small", () => {
    expect(JSON.stringify(sampleRun()).length).toBeLessThan(2_000);
  });
});
