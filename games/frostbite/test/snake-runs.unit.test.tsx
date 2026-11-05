// @vitest-environment jsdom
import type { Result } from "@ador/game-sdk/protocol";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { describe, expect, it, vi } from "vitest";

import type { CabinetHost } from "../src/cabinet/host.ts";
import {
  clickButton,
  container,
  host,
  recordText,
  startRun,
  status,
} from "./support/snake-screen.tsx";

const platformSeed = 424_242;
const runId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const started: Result<"run.start"> = {
  expiresAt: "2026-10-16T12:00:00.000Z",
  runId,
  seed: platformSeed,
  status: "started",
};
function platform(
  start: () => Promise<Result<"run.start">>,
  submit: (
    id: string,
    record: RunRecord,
  ) => Promise<Result<"run.submit">> = async () => ({
    earned: [],
    status: "verified",
  }),
) {
  const runs = { start: vi.fn(start), submit: vi.fn(submit) };
  const withRuns: CabinetHost = { milestone: host.milestone, runs };
  return { runs, withRuns };
}
const note = () => container.querySelector(".if-note")?.textContent ?? "";

describe("a SAT SNAKE run on the platform's seed", () => {
  it("is played on the seed the platform gave, and says only how to play", async () => {
    const { runs, withRuns } = platform(async () => started);
    await startRun(1, withRuns);
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(status()).not.toMatch(/platform|claim|seed/i);
    await clickButton("End run");
    expect(JSON.parse(recordText())).toMatchObject({ seed: platformSeed });
  });

  it("sends the record for the run it was given, and says nothing of what came back", async () => {
    const { runs, withRuns } = platform(
      async () => started,
      async () => ({ earned: ["snake-ten"], status: "verified" }),
    );
    await startRun(1, withRuns);
    await clickButton("End run");
    expect(runs.submit).toHaveBeenCalledTimes(1);
    const [id, sent] = runs.submit.mock.calls[0] ?? [];
    expect(id).toBe(runId);
    expect(sent).toMatchObject({
      config: { cabinet: "sat-snake" },
      gameId: "frostbite",
      seed: platformSeed,
      verifier: "frostbite",
    });
    expect(container.textContent).not.toMatch(/platform|checked|verified/i);
  });

  it("says nothing when the platform rejects the record or cannot be reached", async () => {
    for (const submit of [
      async () => ({
        detail: "the snake cannot turn back on itself",
        reason: "illegal-input",
        status: "rejected",
      }),
      async () => {
        throw new Error("offline");
      },
    ] as Parameters<typeof platform>[1][]) {
      const { withRuns } = platform(async () => started, submit);
      await startRun(1, withRuns);
      await clickButton("End run");
      expect(container.textContent).not.toMatch(/platform|checked|verified/i);
    }
  });

  it("plays on a seed of its own, and says nothing of why, when the platform has no run to give or asking fails", async () => {
    const { runs, withRuns } = platform(async () => ({
      reason: "signed-out",
      status: "unavailable",
    }));
    await startRun(1, withRuns);
    expect(status()).not.toMatch(/platform|claim|seed/i);
    await clickButton("End run");
    expect(runs.submit).not.toHaveBeenCalled();
    expect(JSON.parse(recordText())).toMatchObject({ seed: 1 });
    const failing = platform(async () => {
      throw new Error("offline");
    });
    await startRun(1, failing.withRuns);
    expect(status()).not.toMatch(/platform|claim|seed/i);
  });
});
