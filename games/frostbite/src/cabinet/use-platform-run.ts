import { useRef } from "react";
import type { RunRecord } from "@frostbite/game-sdk/run-record";

import type { CabinetRuns } from "./platform-run.ts";

// What a cabinet does with the platform's runs, in one place: begin a run (on the platform's seed when it gives one, else a
// seed of the browser's own) and hand the platform the finished record. Nothing about how the run is checked is said to the player.
export function usePlatformRun(runs: CabinetRuns | undefined) {
  const runId = useRef<string | null>(null);
  return {
    async begin(newSeed: () => number): Promise<{ readonly seed: number }> {
      const run = await runs?.start().catch(() => null);
      const started = run?.status === "started" ? run : null;
      runId.current = started?.runId ?? null;
      return { seed: started?.seed ?? newSeed() };
    },
    send(record: RunRecord): void {
      if (runId.current === null || runs === undefined) return;
      void runs.submit(runId.current, record).catch(() => undefined);
    },
  };
}
