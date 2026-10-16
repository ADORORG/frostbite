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
