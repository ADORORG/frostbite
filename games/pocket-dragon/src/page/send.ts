import type { PlatformPlay } from "@frostbite/game-sdk/play";
import type { RunRecord } from "@frostbite/game-sdk/run-record";

// Hands a finished run's record to the platform to be replayed, once, under the id the platform gave the run when it began. Nothing is
// sent for a run the platform did not give (no platform, signed out, a test run, the Sky Nursery). A failure (no answer, or a refusal)
// is dropped quietly: the run was played, and the platform says what it made of it. A stand-in for the SDK's `sendRun`
// (`@frostbite/game-sdk/play`) in the owners' newer `dev`, which replaces `run-notes`: switch to it once it is on `dev`.
export async function sendRun(
  play: PlatformPlay | null,
  runId: string | null,
  record: RunRecord,
): Promise<void> {
  if (play === null || runId === null) return;
  await play.runs.submit(runId, record).then(
    () => undefined,
    () => undefined,
  );
}
