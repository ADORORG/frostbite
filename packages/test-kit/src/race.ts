import type { DatabaseClient, DatabaseTransaction } from "@ador/database";
import { expect } from "vitest";

export const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export interface HeldTransaction {
  // Resolves once the transaction has committed after `release`.
  readonly finished: Promise<void>;
  // Lets the transaction commit.
  readonly release: () => void;
}

// Opens a transaction, runs `acquire` in it (taking whatever lock or change the test needs to hold), and
// keeps the transaction open until `release` is called. Resolves once `acquire` has finished, so the
// caller knows the lock is in place before it starts the operation that must wait for it.
export async function holdTransaction<Acquired>(
  database: Pick<DatabaseClient, "transaction">,
  acquire: (transaction: DatabaseTransaction) => Promise<Acquired>,
): Promise<HeldTransaction> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let taken: () => void = () => undefined;
  const lockTaken = new Promise<void>((resolve) => {
    taken = resolve;
  });
  const finished = database.transaction(async (transaction) => {
    await acquire(transaction);
    taken();
    await held;
  });
  await lockTaken;
  return { finished, release };
}

// Starts `attempt`, proves it is still waiting after `waitMilliseconds` (so it really is blocked by
// what the holder took, not merely slow), then lets the holder commit and returns what the attempt
// resolves to. An operation that does not wait fails here instead of racing past the lock, and the
// holder is released either way.
export async function expectToWait<Result>(
  holder: HeldTransaction,
  attempt: () => Promise<Result>,
  waitMilliseconds = 300,
): Promise<Result> {
  let settled = false;
  const outcome = attempt().then((result) => {
    settled = true;
    return result;
  });
  try {
    await pause(waitMilliseconds);
    expect(settled).toBe(false);
  } finally {
    // Always let the holder commit, so a failed check cannot leave its locks blocking later tests.
    holder.release();
    await holder.finished;
  }
  return outcome;
}
