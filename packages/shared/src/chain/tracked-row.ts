import { chainFamilyIdSchema, chainRefSchema } from "./chain-ref.ts";
import { decodeSummary, encodeSummary } from "./summary-codec.ts";
import type { TrackedState } from "./progress.ts";
import type { UnsignedTransaction } from "./transaction.ts";
import { contractRefSchema, type ContractRef } from "./values.ts";

// The columns every table that tracks a built transaction shares (`trackedTransactionColumns` in the database package), as rows
// are read and written. These functions are the one place a stored row becomes a checked transaction and back.
export interface TrackedRow<Contract extends string | null = string> {
  readonly chain: string;
  // Absent (both null) only where the table tracks steps that act on no contract yet.
  readonly contractFamily: Contract;
  readonly contractId: Contract;
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

interface TrackedValue<Contract> {
  readonly chain: ReturnType<typeof chainRefSchema.parse>;
  readonly contract: Contract;
  readonly state: TrackedState;
  readonly unsigned: UnsignedTransaction;
}

// What a row holds, checked on the way out: the chain, the contract, and the transaction as it was built and shown.
export function readTracked(row: TrackedRow): TrackedValue<ContractRef>;
export function readTracked(
  row: TrackedRow<string | null>,
): TrackedValue<ContractRef | null>;
export function readTracked(
  row: TrackedRow<string | null>,
): TrackedValue<ContractRef | null> {
  const chain = chainRefSchema.parse(row.chain);
  if ((row.contractFamily === null) !== (row.contractId === null)) {
    throw new Error(
      "A row names its contract by family and id, or by neither.",
    );
  }
  return {
    chain,
    contract:
      row.contractFamily === null || row.contractId === null
        ? null
        : contractRefSchema.parse({
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

interface Built<Contract> {
  readonly chain: string;
  readonly contract: Contract;
  readonly unsigned: UnsignedTransaction;
}

// The columns for a transaction just built, awaiting its signature.
export function trackedValues(
  built: Built<ContractRef>,
): TrackedColumns<string>;
export function trackedValues(
  built: Built<ContractRef | null>,
): TrackedColumns<string | null>;
export function trackedValues(
  built: Built<ContractRef | null>,
): TrackedColumns<string | null> {
  return {
    chain: built.chain,
    contractFamily: built.contract?.family ?? null,
    contractId: built.contract?.id ?? null,
    summary: encodeSummary(built.unsigned.summary),
    unsignedFamily: built.unsigned.family,
    unsignedFormat: built.unsigned.format,
    unsignedPayload: built.unsigned.payload,
  };
}

interface TrackedColumns<Contract> {
  readonly chain: string;
  readonly contractFamily: Contract;
  readonly contractId: Contract;
  readonly summary: ReturnType<typeof encodeSummary>;
  readonly unsignedFamily: string;
  readonly unsignedFormat: string;
  readonly unsignedPayload: string;
}
