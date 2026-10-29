import { describe, expect, it } from "vitest";

import { startNote, submitNote } from "../src/run-notes.ts";

const started = {
  expiresAt: "2026-12-01T00:00:00.000Z",
  runId: "r1",
  seed: 7,
  status: "started",
} as const;

describe("what a player is told when a run begins", () => {
  it("says the platform will check the run when it is on the platform's seed", () => {
    expect(startNote(started, "Go.")).toBe(
      "Go. The platform will check this run when you end it.",
    );
  });

  it("says why a run is only the game's own report: signed out, too many open runs, or no runs here", () => {
    const why = (reason: string) =>
      startNote({ reason, status: "unavailable" } as never, "Go.");
    expect(why("signed-out")).toContain(
      "Sign in to have the platform check a run.",
    );
    expect(why("too-many-open-runs")).toContain("too many unfinished runs");
    expect(why("anything-else")).toContain(
      "The platform cannot check runs here.",
    );
    expect(startNote(null, "Go.")).toContain(
      "The platform cannot check runs here.",
    );
    for (const reason of ["signed-out", "too-many-open-runs", "x"])
      expect(why(reason)).toContain("on a local seed");
  });
});

describe("what a finished run's record is said to be", () => {
  it("is the player's own claim until the platform has replayed it", () => {
    expect(submitNote(null)).toContain("your own claim");
    expect(submitNote({ kind: "pending" })).toContain("Sending the run");
    expect(submitNote({ kind: "failed" })).toContain("could not be reached");
  });

  it("says what a replay found, without claiming more than it shows", () => {
    const verified = (earned: string[]) =>
      submitNote({
        kind: "settled",
        result: { earned, status: "verified" } as never,
      });
    expect(verified([])).toContain("earned no milestone");
    expect(verified(["a", "b"])).toContain("a, b replay-checked");
    expect(verified(["a"])).toContain("not that a person played it");
    const rejected = submitNote({
      kind: "settled",
      result: { reason: "illegal move", status: "rejected" } as never,
    });
    expect(rejected).toContain("did not accept this run (illegal move)");
  });

  it("explains each refusal, and has a plain sentence for one it does not know", () => {
    const refused = (reason: string) =>
      submitNote({
        kind: "settled",
        result: { reason, status: "refused" } as never,
      });
    expect(refused("already-submitted")).toContain("already submitted");
    expect(refused("expired")).toContain("expired");
    expect(refused("stale")).toContain("rules changed");
    expect(refused("unknown-run")).toContain("no such run");
    expect(refused("mystery")).toContain("The platform refused this run.");
  });
});
