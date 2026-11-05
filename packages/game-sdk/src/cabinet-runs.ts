import type { Result } from "./protocol.ts";
import type { RunRecord } from "./run-record.ts";

// How a cabinet reaches the platform's runs: ask for one (its seed is the platform's, so a player cannot pick an easy board)
// and hand back the record. The page the cabinet runs in supplies it; none means the platform offers no runs here.
export interface CabinetRuns {
  start(): Promise<Result<"run.start">>;
  submit(runId: string, record: RunRecord): Promise<Result<"run.submit">>;
}
