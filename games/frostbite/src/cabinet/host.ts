import type { CabinetRuns } from "./platform-run.ts";

// What a cabinet is given by the page it is mounted in.
export interface CabinetHost {
  milestone(mark: string): void;
  // The platform's runs, where it offers them: a run started there has the platform's seed and can be replay-checked.
  readonly runs?: CabinetRuns;
}
