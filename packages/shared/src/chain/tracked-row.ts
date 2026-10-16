import { chainFamilyIdSchema, chainRefSchema } from "./chain-ref.ts";
import { decodeSummary, encodeSummary } from "./summary-codec.ts";
import type { TrackedState } from "./progress.ts";
import type { UnsignedTransaction } from "./transaction.ts";
import { contractRefSchema, type ContractRef } from "./values.ts";

// The columns every table that tracks a built transaction shares (`trackedTransactionColumns` in the database package), as rows
// are read and written. These functions are the one place a stored row becomes a checked transaction and back.
export interface TrackedRow {
  readonly chain: string;
  readonly contractFamily: string;
  readonly contractId: string;
  readonly expiresAt: Date;
  readonly failureReason: string | null;
  readonly signedPayload: string | null;
  readonly state: string;
  readonly summary: unknown;
  readonly transactionId: string | null;
  readonly unsignedFamily: string;
  readonly unsignedFormat: string;
  readonly unsignedPayload: string;
}

// What a row holds, checked on the way out: the chain, the contract, and the transaction as it was built and shown.
export function readTracked(row: TrackedRow): {
  readonly chain: ReturnType<typeof chainRefSchema.parse>;
  readonly contract: ContractRef;
  readonly state: TrackedState;
  readonly unsigned: UnsignedTransaction;
} {
  const chain = chainRefSchema.parse(row.chain);
  return {
    chain,
    contract: contractRefSchema.parse({
      chain,
      family: row.contractFamily,
      id: row.contractId,
    }),
    // The column's check constraint admits only the tracked states.
    state: row.state as TrackedState,
    unsigned: {
      chain,
      family: chainFamilyIdSchema.parse(row.unsignedFamily),
      format: row.unsignedFormat,
      payload: row.unsignedPayload,
      summary: decodeSummary(row.summary),
    },
  };
}

// The columns for a transaction just built, awaiting its signature.
export function trackedValues(built: {
  readonly chain: string;
  readonly contract: ContractRef;
  readonly unsigned: UnsignedTransaction;
}) {
  return {
    chain: built.chain,
    contractFamily: built.contract.family,
    contractId: built.contract.id,
    summary: encodeSummary(built.unsigned.summary),
    unsignedFamily: built.unsigned.family,
    unsignedFormat: built.unsigned.format,
    unsignedPayload: built.unsigned.payload,
  };
}
