import { Psbt, Transaction } from "bitcoinjs-lib";
import type {
  SignedTransaction,
  UnsignedTransaction,
  VerificationResult,
} from "@ador/shared/chain";

import { psbtFormat } from "../format.ts";
import { callScript } from "../tx/call-script.ts";
import { isSigned, parse, sameBytes, sameTransaction } from "../verify.ts";
import {
  adminCall,
  isAdminOperation,
  needsAuthToken,
  type AdminSource,
} from "./action.ts";
import { bundleFormat, decodeBundle, type Bundle } from "./bundle.ts";
import { dataMatchesSummary } from "./data.ts";
import { createEnvelope, envelopeData } from "./envelope.ts";
import type { AdminOptions } from "./templates.ts";
import { witnessItems } from "./witness.ts";

const callOutput = 1;
const envelopeOutput = 0;
const revealInput = 0;

function sourceOf(summary: UnsignedTransaction["summary"]): AdminSource | null {
  if (!isAdminOperation(summary.operation)) return null;
  return {
    claimLimit: summary.claimLimit,
    collectibleAt: summary.collectibleAt,
    contract: summary.milestone?.contract ?? summary.contract,
    maxDrawingBytes: summary.maxDrawingBytes,
    milestoneId: summary.milestone?.id,
    operation: summary.operation,
    paused: summary.paused,
    templateAt: summary.template?.at,
    templateId: summary.template?.id,
    templateVersion: summary.template?.version,
  };
}

function netFee(psbt: Psbt): bigint {
  const paid = psbt.data.inputs.reduce(
    (sum, input) => sum + (input.witnessUtxo?.value ?? 0n),
    0n,
  );
  return paid - psbt.txOutputs.reduce((sum, out) => sum + out.value, 0n);
}

// The hash a later transaction names this one by. A SegWit transaction's hash does not cover its signatures, so it is the same
// before and after signing.
function transactionHash(psbt: Psbt): Uint8Array {
  const transaction = new Transaction();
  transaction.version = psbt.version;
  transaction.locktime = psbt.locktime;
  for (const input of psbt.txInputs) {
    transaction.addInput(input.hash, input.index, input.sequence);
  }
  for (const output of psbt.txOutputs) {
    transaction.addOutput(output.script, output.value);
  }
  return Uint8Array.from(transaction.getHash());
}

// What the reveal's first input carries, as built: its witness is `[signature, script, control block]`, and the script holds the data.
function revealedData(reveal: Psbt): Uint8Array | null {
  const witness = reveal.data.inputs[revealInput]?.finalScriptWitness;
  const script = witness === undefined ? undefined : witnessItems(witness)?.[1];
  return script === undefined ? null : envelopeData(script);
}

// That the pair is one commit-and-reveal: the reveal spends the commit's first output, which is the address of its own data.
function revealSpendsCommit(bundle: Bundle, data: Uint8Array | null): boolean {
  const input = bundle.reveal.txInputs[revealInput];
  const prevout = bundle.reveal.data.inputs[revealInput]?.witnessUtxo;
  const committed = bundle.commit.txOutputs[envelopeOutput];
  const script = witnessItems(
    bundle.reveal.data.inputs[revealInput]?.finalScriptWitness ??
      new Uint8Array(),
  )?.[1];
  const key = script?.subarray(1, 33);
  return (
    input !== undefined &&
    prevout !== undefined &&
    committed !== undefined &&
    data !== null &&
    key !== undefined &&
    input.index === envelopeOutput &&
    sameBytes(input.hash, transactionHash(bundle.commit)) &&
    prevout.value === committed.value &&
    sameBytes(prevout.script, committed.script) &&
    sameBytes(createEnvelope(key, data).output, committed.script)
  );
}

function sameWitness(a: Psbt, b: Psbt): boolean {
  const first = a.data.inputs[revealInput]?.finalScriptWitness;
  const second = b.data.inputs[revealInput]?.finalScriptWitness;
  return (
    first !== undefined && second !== undefined && sameBytes(first, second)
  );
}

// Checks that what the wallet signed is what was built and shown, for a step of one transaction or two: the same transactions, the
// call and data the summary describes, the stated total fee, and a signature on every input. (Whether each signature is valid is
// Bitcoin's to decide when the transaction is sent.)
export function verifySignedAdmin(
  options: AdminOptions,
  unsigned: UnsignedTransaction,
  signed: SignedTransaction,
): VerificationResult {
  if (
    signed.chain !== unsigned.chain ||
    signed.family !== unsigned.family ||
    signed.format !== unsigned.format ||
    (unsigned.format !== psbtFormat && unsigned.format !== bundleFormat)
  ) {
    return { ok: false, reason: "payload-mismatch" };
  }
  const bundled = unsigned.format === bundleFormat;
  const built = bundled
    ? decodeBundle(unsigned.payload)
    : parse(unsigned.payload);
  const returned = bundled
    ? decodeBundle(signed.payload)
    : parse(signed.payload);
  if (built === null || returned === null) {
    return { ok: false, reason: "payload-mismatch" };
  }
  const builtSet =
    built instanceof Psbt ? [built] : [built.commit, built.reveal];
  const returnedSet =
    returned instanceof Psbt ? [returned] : [returned.commit, returned.reveal];
  if (
    builtSet.length !== returnedSet.length ||
    !builtSet.every((psbt, index) => {
      const other = returnedSet[index];
      return other !== undefined && sameTransaction(psbt, other);
    }) ||
    (!(built instanceof Psbt) &&
      !(returned instanceof Psbt) &&
      !sameWitness(built.reveal, returned.reveal))
  ) {
    return { ok: false, reason: "payload-mismatch" };
  }
  const source = sourceOf(unsigned.summary);
  const call = source === null ? null : adminCall(source, options);
  const carrier = builtSet[builtSet.length - 1];
  const data = built instanceof Psbt ? null : revealedData(built.reveal);
  if (
    source === null ||
    call === null ||
    carrier === undefined ||
    !sameBytes(
      carrier.txOutputs[callOutput]?.script ?? new Uint8Array(),
      callScript(call, {
        pointer: 0,
        refund: 0,
        unallocated: needsAuthToken(source.operation) ? callOutput : 0,
      }),
    ) ||
    (!(built instanceof Psbt) && !revealSpendsCommit(built, data)) ||
    !dataMatchesSummary(source, unsigned.summary, data, options) ||
    builtSet.reduce((sum, psbt) => sum + netFee(psbt), 0n) !==
      unsigned.summary.fee.baseUnits
  ) {
    return { ok: false, reason: "summary-mismatch" };
  }
  return returnedSet.every(isSigned)
    ? { ok: true }
    : { ok: false, reason: "signature-invalid" };
}
