import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { defaultJobs, localCommand, parseCiJobs } from "../src/ci-steps.ts";

const sample = `
name: Verify
jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v6
      - name: Lint
        run: pnpm lint
  shards:
    if: github.event_name == 'push'
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - name: Install
        run: sudo apt-get install -y ffmpeg
      - name: Run (shard \${{ matrix.shard }} of 3)
        run: pnpm test -- --shard=\${{ matrix.shard }}/3
      - name: Two lines
        run: |
          echo one
          echo two

      - name: After
        run: pnpm after
`;

describe("parseCiJobs", () => {
  const jobs = parseCiJobs(sample);

  it("reads job ids, event conditions, shards and the run steps (not the action steps)", () => {
    expect(jobs.map((job) => job.id)).toEqual(["static", "shards"]);
    expect(jobs.map((job) => job.conditional)).toEqual([false, true]);
    expect(jobs[1]?.shards).toEqual(["1", "2", "3"]);
    expect(jobs[0]?.steps).toEqual([
      { name: "Check out repository", run: "" },
      { name: "Lint", run: "pnpm lint" },
    ]);
  });

  it("reads a block run as its lines and goes on to the next step", () => {
    const steps = jobs[1]?.steps ?? [];
    expect(steps.find((step) => step.name === "Two lines")?.run).toBe(
      "echo one\necho two",
    );
    expect(steps.at(-1)).toEqual({ name: "After", run: "pnpm after" });
  });

  it("has no jobs when there is no jobs section", () => {
    expect(parseCiJobs("name: x\n")).toEqual([]);
  });

  it("finds every job the script runs by default in the real workflow, each with a command to run", async () => {
    const real = parseCiJobs(
      await readFile(
        resolve(import.meta.dirname, "../../../.github/workflows/ci.yml"),
        "utf8",
      ),
    );
    for (const id of defaultJobs) {
      const job = real.find((candidate) => candidate.id === id);
      expect(job, id).toBeDefined();
      expect(
        (job?.steps ?? []).filter(
          (step) => localCommand(step.run, job?.shards[0]) !== null,
        ).length,
        id,
      ).toBeGreaterThan(0);
    }
    expect(real.find((job) => job.id === "e2e")?.shards).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
});

describe("localCommand", () => {
  it("puts the shard in, drops --with-deps, and leaves out system installs and empty steps", () => {
    expect(localCommand("pnpm t -- --shard=${{ matrix.shard }}/3", "2")).toBe(
      "pnpm t -- --shard=2/3",
    );
    expect(
      localCommand(
        "pnpm exec playwright install --with-deps chromium",
        undefined,
      ),
    ).toBe("pnpm exec playwright install chromium");
    expect(
      localCommand("sudo apt-get install -y ffmpeg", undefined),
    ).toBeNull();
    expect(localCommand("", undefined)).toBeNull();
  });
});
