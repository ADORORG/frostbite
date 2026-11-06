import { emailCodePolicy } from "./email-code.ts";

// How long finished rows are kept before the worker removes them, and how many one pass removes, as a record: a change is a new version.
// Every row removed here has already stopped doing anything; what is kept is kept because something still reads it.
export const expiredRowPolicy = {
  // The most rows one pass removes from one table, so a backlog drains in steps that never hold a table for long.
  batchSize: 500,
  // A one-time code counts against the send limits for as long as the window those limits look back over, even after it expired, so it is
  // kept that long (the limits would otherwise forget codes early). With a second channel, this becomes the longest of their windows.
  contactCodeRetentionMs: emailCodePolicy.sendWindowMs,
  // A delivered outbox row is only a record that the event went out. Kept for a week so a delivery can still be looked at after the fact; a
  // failed, waiting or in-flight row is never removed, however old. A default to confirm.
  deliveredOutboxRetentionMs: 7 * 24 * 60 * 60 * 1000,
  version: 1,
} as const;
