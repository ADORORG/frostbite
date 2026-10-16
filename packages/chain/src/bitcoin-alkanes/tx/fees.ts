// What a transaction costs, from its shape. The sizes are the virtual-byte weights of the script types we send to (BIP 141, BIP 86),
// rounded up: a native SegWit key-path spend and output of each kind, and the fixed part of any transaction.

export type ScriptKind = "p2tr" | "p2wpkh";

const inputVbytes: Readonly<Record<ScriptKind, number>> = {
  p2tr: 58,
  p2wpkh: 68,
};
const outputVbytes: Readonly<Record<ScriptKind, number>> = {
  p2tr: 43,
  p2wpkh: 31,
};
// Version, lock time, the two counts and the SegWit marker and flag.
const fixedVbytes = 11;
// An output's value (8 bytes) and the length of its script (1 byte), before the script itself.
const outputFramingVbytes = 9;

// `opReturnScriptLength` is the length of the `OP_RETURN` output's script, or null when the transaction has no such output.
export function estimateVsize(
  inputs: readonly ScriptKind[],
  outputs: readonly ScriptKind[],
  opReturnScriptLength: number | null,
): number {
  return (
    fixedVbytes +
    inputs.reduce((sum, kind) => sum + inputVbytes[kind], 0) +
    outputs.reduce((sum, kind) => sum + outputVbytes[kind], 0) +
    (opReturnScriptLength === null
      ? 0
      : outputFramingVbytes + opReturnScriptLength)
  );
}

// Fee rates are quoted to a thousandth of a satoshi per virtual byte; the arithmetic is whole numbers so that, for example, 170 vB at
// 1.1 sat/vB is exactly 187 satoshis and not 188 from a floating-point remainder.
const rateScale = 1000n;

// Satoshis for `vsize` virtual bytes at `satPerVbyte`, rounded up to a whole satoshi.
export function feeFor(vsize: number, satPerVbyte: number): bigint {
  const rate = BigInt(Math.round(satPerVbyte * Number(rateScale)));
  return (BigInt(vsize) * rate + rateScale - 1n) / rateScale;
}
