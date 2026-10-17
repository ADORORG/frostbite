import type { AlkaneId } from "./alkane-id.ts";
import { fromHex } from "./hex.ts";
import { firstBytes, firstVarint, readFields } from "./protobuf.ts";

// How an Alkanes call ended, from its recorded trace. `none` means the indexer holds no trace for the output: it has not reached
// the block yet, or the output is not a call.
export type TraceOutcome = "failure" | "none" | "success";

// The flag in an exit event of `alkanes.proto` (`AlkanesTraceStatusFlag`).
const failureFlag = 1n;

// Calls nest: every inner call exits before the outer one, so the last exit event is the outcome of the call the transaction made.
export function decodeTraceOutcome(hex: string): TraceOutcome {
  const events = readFields(fromHex(hex)).filter(
    (field) => field.number === 1 && field.kind === "bytes",
  );
  let outcome: TraceOutcome = "none";
  for (const event of events) {
    if (event.kind !== "bytes") continue;
    const exit = firstBytes(readFields(event.value), 2);
    if (exit === undefined) continue;
    const status = firstVarint(readFields(exit), 1) ?? 0n;
    outcome = status === failureFlag ? "failure" : "success";
  }
  return outcome;
}

// A `uint128` of `alkanes.proto`: the low and high halves, each a 64-bit number.
function wholeOf(message: Uint8Array | undefined): bigint {
  if (message === undefined) return 0n;
  const fields = readFields(message);
  return (
    (firstVarint(fields, 1) ?? 0n) | ((firstVarint(fields, 2) ?? 0n) << 64n)
  );
}

// The Alkanes a call created, in the order the indexer recorded them (`create_alkane` events). A game made from its template is the
// first: the contract's own `initialize` then creates its auth token, which follows.
export function decodeTraceCreated(hex: string): readonly AlkaneId[] {
  const created: AlkaneId[] = [];
  for (const event of readFields(fromHex(hex))) {
    if (event.number !== 1 || event.kind !== "bytes") continue;
    const create = firstBytes(readFields(event.value), 3);
    const id =
      create === undefined ? undefined : firstBytes(readFields(create), 1);
    if (id === undefined) continue;
    const parts = readFields(id);
    created.push({
      block: wholeOf(firstBytes(parts, 1)),
      tx: wholeOf(firstBytes(parts, 2)),
    });
  }
  return created;
}

// What the indexer recorded of one call: how it ended and what it created.
export interface TraceReport {
  readonly created: readonly AlkaneId[];
  readonly outcome: TraceOutcome;
}

export function decodeTrace(hex: string): TraceReport {
  return {
    created: decodeTraceCreated(hex),
    outcome: decodeTraceOutcome(hex),
  };
}
