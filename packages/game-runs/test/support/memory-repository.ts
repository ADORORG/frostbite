import type {
  GameRunRepository,
  NewRun,
  RunVerdict,
  StoredRun,
} from "../../src/repository.ts";

// The repository's contract in memory, for the service's unit tests: what the Drizzle repository does under a row lock, one
// call at a time.
export function memoryRepository() {
  const runs = new Map<string, StoredRun>();
  const verdicts = new Map<string, RunVerdict>();
  const repository: GameRunRepository = {
    async issue(run: NewRun, maxOpenRuns) {
      const open = [...runs.values()].filter(
        (stored) =>
          stored.userId === run.userId &&
          stored.gameId === run.gameId &&
          stored.state === "issued",
      );
      if (open.length >= maxOpenRuns)
        return { code: "too-many-open-runs", ok: false };
      runs.set(run.id, { ...run, state: "issued" });
      return { ok: true };
    },
    async submit(key, decide) {
      const run = runs.get(key.runId);
      if (
        run === undefined ||
        run.userId !== key.userId ||
        run.gameId !== key.gameId
      )
        return { code: "not-found", ok: false };
      const decision = decide(run);
      if (decision.kind === "refuse") {
        if (decision.expire && run.state === "issued")
          runs.set(run.id, { ...run, state: "expired" });
        return { code: decision.code, ok: false };
      }
      const settled: StoredRun = { ...run, state: "submitted" };
      runs.set(run.id, settled);
      verdicts.set(run.id, decision.verdict);
      return { ok: true, run: settled, verdict: decision.verdict };
    },
  };
  return { repository, runs, verdicts };
}
