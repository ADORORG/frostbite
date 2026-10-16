import { transactionStates } from "@ador/shared/chain";
import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// What every platform record of a transaction it built, had signed and follows to the chain shares (ADR-017 section 5): the
// states are the neutral transaction states and `expired` (built, never signed in time), and the same coherence rules hold. A table
// adds its own subject (who, what) and uses these for the rest, so the lifecycle has one definition in the database.
const quote = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));
const states = quote([...transactionStates, "expired"]);
// A transaction in one of these is over: it took effect or never will. Any other is in progress.
export const settledStatesSql = quote([
  "broadcast_rejected",
  "complete",
  "expired",
  "indexed_failure",
]);

export const trackedTransactionColumns = {
  chain: text("chain").notNull(),
  contractFamily: text("contract_family").notNull(),
  contractId: text("contract_id").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  failureReason: text("failure_reason"),
  signedPayload: text("signed_payload"),
  state: text("state").notNull(),
  // What the person was shown: the summary.
  summary: jsonb("summary").notNull(),
  transactionId: text("transaction_id"),
  // What was built: the adapter's family, format and opaque payload.
  unsignedFamily: text("unsigned_family").notNull(),
  unsignedFormat: text("unsigned_format").notNull(),
  unsignedPayload: text("unsigned_payload").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
};

interface TrackedTable {
  readonly failureReason: AnyPgColumn;
  readonly signedPayload: AnyPgColumn;
  readonly state: AnyPgColumn;
  readonly transactionId: AnyPgColumn;
  readonly unsignedPayload: AnyPgColumn;
}

// The checks every such table carries, named after the table. The signed transaction exists from the moment it is signed, and the
// network's id for it from the moment the network answered; a transaction that failed says why, and no other has a reason.
export function trackedTransactionChecks(name: string, table: TrackedTable) {
  const {
    failureReason,
    signedPayload,
    state,
    transactionId,
    unsignedPayload,
  } = table;
  return [
    check(`${name}_state_known`, sql`${state} in (${states})`),
    check(
      `${name}_payload_bounded`,
      sql`char_length(${unsignedPayload}) <= 65536 and (${signedPayload} is null or char_length(${signedPayload}) <= 65536)`,
    ),
    check(
      `${name}_signed_coherent`,
      sql`(${state} in ('constructed', 'simulated', 'awaiting_signature', 'expired')) = (${signedPayload} is null)`,
    ),
    check(
      `${name}_transaction_coherent`,
      sql`(${state} in ('constructed', 'simulated', 'awaiting_signature', 'signed', 'expired', 'broadcast_rejected')) = (${transactionId} is null)`,
    ),
    check(
      `${name}_failure_coherent`,
      sql`(${state} in ('broadcast_rejected', 'indexed_failure')) = (${failureReason} is not null)`,
    ),
  ];
}
