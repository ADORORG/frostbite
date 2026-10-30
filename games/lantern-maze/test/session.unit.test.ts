import { replayRecord } from "@ador/game-sdk/replay";
import { describe, expect, it, vi } from "vitest";

import { directions } from "../src/rules/constants.ts";
import { cellOpen } from "../src/rules/maze.ts";
import { mazeRules } from "../src/rules/index.ts";
import { sampleRun } from "../src/sample-run.ts";
import { createMazeSession } from "../src/session.ts";
import { scout } from "./support/bots.ts";

describe("a session", () => {
  it("records the steps the rules accept, and refuses a wall without recording it", () => {
    const session = createMazeSession({ seed: 7 });
    const { layout, position } = session.state();
    const wall = directions.find((_, d) => !cellOpen(layout.maze, position, d));
    const way = directions.find((_, d) => cellOpen(layout.maze, position, d));
    if (wall === undefined || way === undefined) throw new Error("no wall");
    expect(session.move(wall)).toEqual({
      ok: false,
      reason: "a wall is there",
    });
    expect(session.move(way)).toEqual({ ok: true });
    const record = session.record();
    expect(record.inputs).toEqual([{ type: way }, { type: "end" }]);
    expect(session.move(way)).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    expect(session.state().ended).toBe(true);
  });

  it("makes a record the platform's replay accepts, and tells the page each milestone once", () => {
    const onEarned = vi.fn();
    const session = createMazeSession({ onEarned, seed: 31 });
    const { steps } = scout(31);
    for (const step of steps) session.move(directions[step] ?? "up");
    const record = session.record();
    expect(record.inputs).toHaveLength(
      steps.length + (session.state().cause === "escaped" ? 0 : 1),
    );
    expect(replayRecord(mazeRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    const ids = onEarned.mock.calls.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...session.earned()].sort());
    expect(ids).toContain("floors-30");
  });

  it("does not close a run twice, and a run needs no listener", () => {
    const session = createMazeSession({ seed: 2 });
    const first = session.record();
    const again = session.record();
    expect(again.inputs).toEqual(first.inputs);
    expect(first.inputs).toEqual([{ type: "end" }]);
  });
});

describe("the sample run", () => {
  it("is accepted by the rules and earns the milestones it claims", () => {
    const record = sampleRun();
    expect(replayRecord(mazeRules, record)).toEqual({
      earned: record.claims,
      ok: true,
    });
    expect(record.claims.length).toBeGreaterThan(10);
  });
});
