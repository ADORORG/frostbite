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
  it("is played on the seed the platform gave and says the platform will check it", async () => {
    const { runs, withRuns } = platform(async () => started);
    await startRun(1, withRuns);
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(status()).toContain(
      "The platform will check this run when you end it.",
    );
    await clickButton("End run");
    expect(JSON.parse(recordText())).toMatchObject({ seed: platformSeed });
  });

  it("sends the record for the run it was given, and calls it checked only when the platform says so", async () => {
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
    expect(note()).toContain("Earned: snake-ten.");
  });

  it("says so when the platform rejects the record, and keeps the milestone as the player's own claim", async () => {
    const { withRuns } = platform(
      async () => started,
      async () => ({
        detail: "the snake cannot turn back on itself",
        reason: "illegal-input",
        status: "rejected",
      }),
    );
    await startRun(1, withRuns);
    await clickButton("End run");
    expect(note()).toContain("did not accept this run");
    expect(note()).toContain("your own claim");
  });

  it("says the platform could not be reached when sending fails", async () => {
    const { withRuns } = platform(
      async () => started,
      async () => {
        throw new Error("offline");
      },
    );
    await startRun(1, withRuns);
    await clickButton("End run");
    expect(note()).toContain("could not be reached");
  });

  it("plays on a local seed when the platform has no run to give, and says why", async () => {
    const { runs, withRuns } = platform(async () => ({
      reason: "signed-out",
      status: "unavailable",
    }));
    await startRun(1, withRuns);
    expect(status()).toContain("Sign in to have the platform check a run.");
    await clickButton("End run");
    expect(runs.submit).not.toHaveBeenCalled();
    expect(JSON.parse(recordText())).toMatchObject({ seed: 1 });
  });

  it("plays on a local seed when asking for a run fails", async () => {
    const { withRuns } = platform(async () => {
      throw new Error("offline");
    });
    await startRun(1, withRuns);
    expect(status()).toContain("The platform cannot check runs here.");
  });
});
