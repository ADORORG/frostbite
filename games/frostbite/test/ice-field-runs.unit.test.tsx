// @vitest-environment jsdom
import type { Result } from "@ador/game-sdk/protocol";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { describe, expect, it, vi } from "vitest";

import type { IceFieldHost } from "../src/ice-field/ice-field.tsx";
import {
  clearBoard,
  clickButton,
  clickTile,
  container,
  host,
  safeTiles,
  seed,
  seeds,
  startRun,
  status,
} from "./support/screen.tsx";

const platformSeed = 12_345;
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
    runId: string,
    record: RunRecord,
  ) => Promise<Result<"run.submit">> = async () => ({
    earned: [],
    status: "verified",
  }),
) {
  const runs = {
    start: vi.fn(start),
    submit: vi.fn(submit),
  };
  const withRuns: IceFieldHost = { milestone: host.milestone, runs };
  return { runs, withRuns };
}
const recordText = () =>
  container.querySelector<HTMLTextAreaElement>(".if-record-text")?.value ?? "";
const note = () => container.querySelector(".if-note")?.textContent ?? "";

describe("a run on the platform's seed", () => {
  it("is played on the seed the platform gave, not the browser's, and says the platform will check it", async () => {
    const { runs, withRuns } = platform(async () => started);
    await startRun(withRuns);
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(seeds).not.toHaveBeenCalled();
    expect(status()).toBe(
      "Pick a tile. A mine ends the board. The platform will check this run when you end it.",
    );
    await clickTile(0);
    await clickButton("End run");
    expect(JSON.parse(recordText())).toMatchObject({ seed: platformSeed });
  });

  it("sends the finished record to the platform for the run it was given, and says it was replay-checked only when the platform says so", async () => {
    const { runs, withRuns } = platform(
      async () => started,
      async () => ({ earned: ["first-win"], status: "verified" }),
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(runs.submit).toHaveBeenCalledTimes(1);
    const [id, sent] = runs.submit.mock.calls[0] ?? [];
    expect(id).toBe(runId);
    expect(sent).toMatchObject({ gameId: "frostbite", seed: platformSeed });
    expect(note()).toBe(
      "The platform replayed this run and it followed the rules: first-win replay-checked. That shows the run was legal, not that a person played it.",
    );
  });

  it("says a run that earned nothing followed the rules and earned no milestone", async () => {
    const { withRuns } = platform(async () => started);
    await startRun(withRuns);
    await clickButton("End run");
    expect(note()).toBe(
      "The platform replayed this run and it followed the rules. It earned no milestone.",
    );
  });

  it("says the platform's rejection, and that the milestones are the player's own claim", async () => {
    const { withRuns } = platform(
      async () => started,
      async () => ({ reason: "illegal-input", status: "rejected" }),
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(note()).toBe(
      "The platform did not accept this run (illegal-input). Milestones earned here are your own claim.",
    );
  });

  it.each([
    ["expired", "This run took too long to end and has expired."],
    ["already-submitted", "This run was already submitted."],
    ["stale", "The game's rules changed since this run began."],
    ["unknown-run", "The platform has no such run."],
  ] as const)("says why a %s run was refused", async (reason, text) => {
    const { withRuns } = platform(
      async () => started,
      async () => ({ reason, status: "refused" }),
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(note()).toBe(`${text} Milestones earned here are your own claim.`);
  });

  it("says the platform could not be reached, without a verdict, when sending fails", async () => {
    const { withRuns } = platform(
      async () => started,
      async () => {
        throw new Error("offline");
      },
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(note()).toBe(
      "The platform could not be reached, so this run was not checked. Milestones earned here are your own claim.",
    );
  });

  it("says it is sending while the platform has not answered", async () => {
    const { withRuns } = platform(
      async () => started,
      () => new Promise(() => undefined),
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(note()).toBe("Sending the run to the platform to be replayed…");
  });

  it("asks for a new run each time one starts, and sends each record for its own run", async () => {
    let issued = 0;
    const { runs, withRuns } = platform(async () => ({
      ...started,
      runId: `run-${String((issued += 1))}`,
      seed: platformSeed + issued,
    }));
    await startRun(withRuns);
    await clickButton("End run");
    await clickButton("Start another run");
    await clickButton("End run");
    expect(runs.start).toHaveBeenCalledTimes(2);
    expect(runs.submit.mock.calls.map(([id]) => id)).toEqual([
      "run-1",
      "run-2",
    ]);
  });
});

describe("a run without the platform's seed", () => {
  it.each([
    [
      { reason: "signed-out", status: "unavailable" },
      "Sign in to have the platform check a run.",
    ],
    [
      { reason: "not-supported", status: "unavailable" },
      "The platform cannot check runs here.",
    ],
    [
      { reason: "too-many-open-runs", status: "unavailable" },
      "You have too many unfinished runs on the platform; end some, or wait for them to expire.",
    ],
  ] as const)(
    "is played on the browser's seed and says why: %j",
    async (answer, why) => {
      const { runs, withRuns } = platform(async () => answer);
      await startRun(withRuns);
      expect(seeds).toHaveBeenCalledTimes(1);
      expect(status()).toBe(
        `Pick a tile. A mine ends the board. This run is on a local seed, so its milestones are the game's own report. ${why}`,
      );
      await clearBoard(0);
      await clickButton("End run");
      expect(JSON.parse(recordText())).toMatchObject({ seed });
      expect(runs.submit).not.toHaveBeenCalled();
      expect(note()).toContain("was not sent to the platform");
    },
  );

  it("is played on the browser's seed when asking the platform fails", async () => {
    const { runs, withRuns } = platform(async () => {
      throw new Error("offline");
    });
    await startRun(withRuns);
    expect(seeds).toHaveBeenCalledTimes(1);
    expect(status()).toContain("The platform cannot check runs here.");
    await clickTile(safeTiles()[0] ?? 0);
    await clickButton("End run");
    expect(runs.submit).not.toHaveBeenCalled();
  });
});
