import type { Pool } from "pg";

// How long to wait for the sessions of a pool that has just been closed to leave the server, and how often to look.
const sessionsLeaveWithinMs = 10_000;
const lookEveryMs = 50;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

// Drops a scratch database once nothing is connected to it. A closed pool's sessions leave the server a moment after `end()` returns, and
// `drop database ... with (force)` would terminate them mid-close: the client then receives a FATAL it has no listener for and the test run
// dies with an unhandled error (seen on a slow CI runner). A session that does not leave is a leak, and the plain drop reports it.
export async function dropScratchDatabase(
  admin: Pick<Pool, "query">,
  name: string,
): Promise<void> {
  const until = Date.now() + sessionsLeaveWithinMs;
  while (Date.now() < until) {
    const sessions = await admin.query(
      "select 1 from pg_stat_activity where datname = $1",
      [name],
    );
    if (sessions.rowCount === 0) break;
    await sleep(lookEveryMs);
  }
  await admin.query(`drop database if exists ${name}`);
}

// A fresh empty database of this name: the one left by an earlier run is dropped first.
export async function createScratchDatabase(
  admin: Pick<Pool, "query">,
  name: string,
): Promise<void> {
  await dropScratchDatabase(admin, name);
  await admin.query(`create database ${name}`);
}
