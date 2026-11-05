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
const instruction = "Pick a tile. A mine ends the board.";

// How a run is checked is not part of playing: nothing the platform answers is said to the player.
describe("a run on the platform's seed", () => {
  it("is played on the seed the platform gave, not the browser's, and says only how to play", async () => {
    const { runs, withRuns } = platform(async () => started);
    await startRun(withRuns);
    expect(runs.start).toHaveBeenCalledTimes(1);
    expect(seeds).not.toHaveBeenCalled();
    expect(status()).toBe(instruction);
    await clickTile(0);
    await clickButton("End run");
    expect(JSON.parse(recordText())).toMatchObject({ seed: platformSeed });
  });

  it("sends the finished record to the platform for the run it was given, and says nothing of what came back", async () => {
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
    expect(container.querySelector(".if-note")).toBeNull();
    expect(container.textContent).not.toMatch(/platform|checked|verified/i);
  });

  it.each([
    ["rejected", { reason: "illegal-input", status: "rejected" }],
    ["refused", { reason: "expired", status: "refused" }],
  ] as const)(
    "says nothing when the platform %s the run",
    async (_name, answer) => {
      const { withRuns } = platform(
        async () => started,
        async () => answer,
      );
      await startRun(withRuns);
      await clickButton("End run");
      expect(container.querySelector(".if-note")).toBeNull();
      expect(container.textContent).not.toMatch(/platform|checked|verified/i);
    },
  );

  it("says nothing, and does not fail, when sending fails", async () => {
    const { runs, withRuns } = platform(
      async () => started,
      async () => {
        throw new Error("offline");
      },
    );
    await startRun(withRuns);
    await clickButton("End run");
    expect(runs.submit).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toMatch(/platform|checked|verified/i);
    expect(JSON.parse(recordText())).toMatchObject({ seed: platformSeed });
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
    { reason: "signed-out", status: "unavailable" },
    { reason: "not-supported", status: "unavailable" },
    { reason: "too-many-open-runs", status: "unavailable" },
  ] as const)(
    "is played on the browser's seed, sends nothing and says only how to play: %j",
    async (answer) => {
      const { runs, withRuns } = platform(async () => answer);
      await startRun(withRuns);
      expect(seeds).toHaveBeenCalledTimes(1);
      expect(status()).toBe(instruction);
      await clearBoard(0);
      await clickButton("End run");
      expect(JSON.parse(recordText())).toMatchObject({ seed });
      expect(runs.submit).not.toHaveBeenCalled();
    },
  );

  it("is played on the browser's seed when asking the platform fails", async () => {
    const { runs, withRuns } = platform(async () => {
      throw new Error("offline");
    });
    await startRun(withRuns);
    expect(seeds).toHaveBeenCalledTimes(1);
    expect(status()).toBe(instruction);
    await clickTile(safeTiles()[0] ?? 0);
    await clickButton("End run");
    expect(runs.submit).not.toHaveBeenCalled();
  });
});
