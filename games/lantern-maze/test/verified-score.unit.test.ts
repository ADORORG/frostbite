import { expectVerifiedScore } from "@frostbite/test-kit/verified-score";
import { describe, it } from "vitest";

import { mazeRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";

describe("the score the platform reads from a replay", () => {
  it("is the score the game shows and keeps, once the run has ended, and none before", () => {
    expectVerifiedScore(mazeRules, sampleRun(), (state) => state.score);
  });
});
