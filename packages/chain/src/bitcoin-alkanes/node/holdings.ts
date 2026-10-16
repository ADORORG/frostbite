import type { AlkaneId } from "./alkane-id.ts";
import { fromHex } from "./hex.ts";
import { firstBytes, firstVarint, readFields } from "./protobuf.ts";

// What an output holds, as the indexer reports it: the output itself and the Alkane tokens on it.
export interface OutputHoldings {
  readonly alkanes: readonly {
    readonly amount: bigint;
    readonly id: AlkaneId;
  }[];
  readonly script: Uint8Array;
  readonly value: bigint;
}

// A `uint128` message holds the low and high 64 bits; an unset field is zero.
function uint128(bytes: Uint8Array | undefined): bigint {
  if (bytes === undefined) return 0n;
  const fields = readFields(bytes);
  return (
    (firstVarint(fields, 1) ?? 0n) | ((firstVarint(fields, 2) ?? 0n) << 64n)
  );
}

// `OutpointResponse` of `protorune.proto`, reduced to what administration needs. An output the indexer has no record of answers
// with empty fields, which reads as holding nothing.
export function decodeHoldings(hex: string): OutputHoldings {
  const top = readFields(fromHex(hex));
  const entries = readFields(firstBytes(top, 1) ?? new Uint8Array()).filter(
    (field) => field.number === 1 && field.kind === "bytes",
  );
  const alkanes = entries.flatMap((entry) => {
    if (entry.kind !== "bytes") return [];
    const fields = readFields(entry.value);
    const rune = readFields(firstBytes(fields, 1) ?? new Uint8Array());
    const id = readFields(firstBytes(rune, 1) ?? new Uint8Array());
    return [
      {
        amount: uint128(firstBytes(fields, 2)),
        id: {
          block: uint128(firstBytes(id, 1)),
          tx: uint128(firstBytes(id, 2)),
        },
      },
    ];
  });
  const output = readFields(firstBytes(top, 3) ?? new Uint8Array());
  return {
    alkanes,
    script: firstBytes(output, 1) ?? new Uint8Array(),
    value: firstVarint(output, 2) ?? 0n,
  };
}
