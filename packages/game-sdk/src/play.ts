import type { GameClient } from "./client.ts";
import { jsonValueSchema } from "./protocol.ts";
import { canonicalJson, type RunRecord } from "./run-record.ts";
import type { CabinetRuns } from "./cabinet-runs.ts";

// What a page of a game needs from the platform to report what a player earns and to have a run checked, in one place. A page opened
// outside the platform has no host to answer; then nothing is reported, and a run is played on a seed of the page's own and its
// milestones are the game's own report.
export interface PlatformPlay {
  // Tells the platform a milestone was earned, if the game's manifest declares it (the manifest decides which of the game's marks
  // count) and it has not been told already. A failed call is dropped and tried again the next time the game makes the mark.
  report(milestone: string): void;
  readonly runs: CabinetRuns;
}

type PlayClient = Pick<GameClient, "milestones" | "run">;

export async function connectToPlatform(
  client: PlayClient,
): Promise<PlatformPlay> {
  const declared = new Set(
    (await client.milestones.list().catch(() => [])).map(({ id }) => id),
  );
  const reported = new Set<string>();
  return {
    report(milestone) {
      if (!declared.has(milestone) || reported.has(milestone)) return;
      reported.add(milestone);
      void client.milestones
        .unlock(milestone)
        .catch(() => reported.delete(milestone));
    },
    runs: {
      // Outside the platform, or for a player it cannot give a run, a game plays on a seed of its own.
      start: () =>
        client.run
          .start()
          .catch(() => ({ reason: "not-supported", status: "unavailable" })),
      submit: (runId: string, record: RunRecord) =>
        client.run.submit(
          runId,
          jsonValueSchema.parse(JSON.parse(canonicalJson(record))),
        ),
    },
  };
}

// Hands a finished run's record to the platform to be replayed, and says nothing to the player about it: how a run is checked is not
// part of playing. A run with no platform run (a page opened outside the platform, or a player the platform could not give one) is
// not sent, and one the platform cannot be reached for is dropped; its milestones are then the game's own report.
export async function sendRun(
  play: PlatformPlay | null,
  runId: string | null,
  record: RunRecord,
): Promise<void> {
  if (play === null || runId === null) return;
  await play.runs.submit(runId, record).catch(() => undefined);
}
