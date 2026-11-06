import type { ExpiredRowCounts } from "@frostbite/database";

export interface RowSweepDependencies {
  readonly clock: () => Date;
  // Called for every pass that removed something, with what went from each table.
  readonly onResult: (counts: ExpiredRowCounts) => void;
  // One bounded removal of the rows that have finished their work, as of the time given.
  readonly remove: (now: Date) => Promise<ExpiredRowCounts>;
}

// One housekeeping pass for the drain loop: expired challenges, expired contact codes and delivered outbox rows. Progress is the number
// of rows removed: while a pass removes anything the loop goes again at once (a backlog drains a batch at a time), and when nothing is
// left it waits the idle delay.
export function createRowSweepPass(
  dependencies: RowSweepDependencies,
): () => Promise<number> {
  return async () => {
    const counts = await dependencies.remove(dependencies.clock());
    const removed =
      counts.contactCodes +
      counts.deliveredOutboxEvents +
      counts.passkeyChallenges +
      counts.passkeySignInChallenges +
      counts.walletChallenges;
    if (removed > 0) dependencies.onResult(counts);
    return removed;
  };
}
