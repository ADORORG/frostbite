import type { Result } from "@ador/game-sdk/protocol";
import type { RunRecord } from "@ador/game-sdk/run-record";

// How the cabinet reaches the platform's runs: ask for one (its seed is the platform's, so a player cannot pick an easy board)
// and hand back the record. The page the cabinet runs in supplies it; none means the platform offers no runs here.
export interface IceFieldRuns {
  start(): Promise<Result<"run.start">>;
  submit(runId: string, record: RunRecord): Promise<Result<"run.submit">>;
}

// What a player is told when a run begins, and why it is or is not one the platform will check. A run without the platform's
// seed is played on a seed the browser made, and its milestones are only the game's own report.
export function startNote(start: Result<"run.start"> | null): string {
  const base = "Pick a tile. A mine ends the board.";
  if (start?.status === "started")
    return `${base} The platform will check this run when you end it.`;
  const why =
    start?.status === "unavailable" && start.reason === "signed-out"
      ? "Sign in to have the platform check a run."
      : start?.status === "unavailable" && start.reason === "too-many-open-runs"
        ? "You have too many unfinished runs on the platform; end some, or wait for them to expire."
        : "The platform cannot check runs here.";
  return `${base} This run is on a local seed, so its milestones are the game's own report. ${why}`;
}

// What the platform said about a submitted record, or that it could not be reached.
export type SubmitState =
  | { readonly kind: "failed" }
  | { readonly kind: "pending" }
  | { readonly kind: "settled"; readonly result: Result<"run.submit"> };

const refusals: Record<string, string> = {
  "already-submitted": "This run was already submitted.",
  expired: "This run took too long to end and has expired.",
  stale: "The game's rules changed since this run began.",
  "unknown-run": "The platform has no such run.",
};

// What the finished run's record is, said as far as it is true: replay-checked only when the platform replayed it.
export function submitNote(state: SubmitState | null): string {
  if (state === null)
    return "Milestones earned here are your own claim: this run was not sent to the platform to be checked.";
  if (state.kind === "pending")
    return "Sending the run to the platform to be replayed…";
  if (state.kind === "failed")
    return "The platform could not be reached, so this run was not checked. Milestones earned here are your own claim.";
  const { result } = state;
  if (result.status === "verified")
    return result.earned.length === 0
      ? "The platform replayed this run and it followed the rules. It earned no milestone."
      : `The platform replayed this run and it followed the rules: ${result.earned.join(", ")} replay-checked. That shows the run was legal, not that a person played it.`;
  if (result.status === "rejected")
    return `The platform did not accept this run (${result.reason}). Milestones earned here are your own claim.`;
  return `${refusals[result.reason] ?? "The platform refused this run."} Milestones earned here are your own claim.`;
}
