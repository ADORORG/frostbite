import { useState } from "react";
import type { RunRecord } from "@ador/game-sdk/run-record";

import {
  startNote,
  type CabinetRuns,
  type SubmitState,
} from "./platform-run.ts";

// What a cabinet does with the platform's runs, in one place: begin a run (on the platform's seed when it gives one, else a
// seed of the browser's own, said as such) and hand the platform the finished record, keeping what became of it.
export function usePlatformRun(runs: CabinetRuns | undefined) {
  const [runId, setRunId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmitState | null>(null);
  return {
    async begin(
      newSeed: () => number,
      instruction: string,
    ): Promise<{ readonly note: string; readonly seed: number }> {
      const run = await runs?.start().catch(() => null);
      const started = run?.status === "started" ? run : null;
      setRunId(started?.runId ?? null);
      setSubmitted(null);
      return {
        note: startNote(run ?? null, instruction),
        seed: started?.seed ?? newSeed(),
      };
    },
    send(record: RunRecord): void {
      if (runId === null || runs === undefined) return;
      setSubmitted({ kind: "pending" });
      runs.submit(runId, record).then(
        (result) => setSubmitted({ kind: "settled", result }),
        () => setSubmitted({ kind: "failed" }),
      );
    },
    submitted,
  };
}
