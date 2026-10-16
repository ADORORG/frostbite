import { Psbt } from "bitcoinjs-lib";
import type {
  ChainRef,
  SignedTransaction,
  UnsignedTransaction,
  VerificationResult,
} from "@ador/shared/chain";

import { validateBitcoinAddress } from "../bitcoin/address.ts";
import { psbtFormat } from "./format.ts";
import { milestoneKey } from "./milestone-key.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { fromHex } from "./node/hex.ts";
import { claimScript } from "./tx/claim-call.ts";

function parse(payload: string): Psbt | null {
  try {
    return Psbt.fromBase64(payload);
  } catch {
    return null;
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

// The transaction two PSBTs describe is the same one: same version, lock time, inputs (outpoint and sequence) and outputs.
function sameTransaction(a: Psbt, b: Psbt): boolean {
  return (
    a.version === b.version &&
    a.locktime === b.locktime &&
    a.txInputs.length === b.txInputs.length &&
    a.txOutputs.length === b.txOutputs.length &&
    a.txInputs.every((input, index) => {
      const other = b.txInputs[index];
      return (
        other !== undefined &&
        sameBytes(input.hash, other.hash) &&
        input.index === other.index &&
        input.sequence === other.sequence
      );
    }) &&
    a.txOutputs.every((output, index) => {
      const other = b.txOutputs[index];
      return (
        other !== undefined &&
        output.value === other.value &&
        sameBytes(output.script, other.script)
      );
    })
  );
}

// What the person was shown must be what the transaction does: the collectible goes to the stated recipient (output 0), the second
// output makes exactly the stated claim, and the fee is the stated fee.
function matchesSummary(
  unsigned: UnsignedTransaction,
  psbt: Psbt,
  chains: ReadonlyMap<ChainRef, ServedChain>,
): boolean {
  const { summary } = unsigned;
  const milestone = summary.milestone;
  const recipient = summary.recipient;
  if (
    summary.operation !== "mint-milestone" ||
    milestone === undefined ||
    recipient === undefined
  )
    return false;
  const game = parseAlkaneId(milestone.contract.id);
  const address = validateBitcoinAddress(
    recipient.value,
    servedChain(chains, unsigned.chain).network,
  );
  if (game === null || !address.ok) return false;
  const [claimant, call] = psbt.txOutputs;
  const paid = psbt.data.inputs.reduce(
    (sum, input) => sum + (input.witnessUtxo?.value ?? 0n),
    0n,
  );
  const spent = psbt.txOutputs.reduce((sum, output) => sum + output.value, 0n);
  return (
    claimant !== undefined &&
    call !== undefined &&
    sameBytes(claimant.script, fromHex(address.value.scriptHex)) &&
    sameBytes(call.script, claimScript(game, milestoneKey(milestone.id))) &&
    paid - spent === summary.fee.baseUnits
  );
}

function isSigned(psbt: Psbt): boolean {
  return psbt.data.inputs.every(
    (input) =>
      input.finalScriptWitness !== undefined ||
      input.finalScriptSig !== undefined ||
      input.tapKeySig !== undefined ||
      (input.partialSig?.length ?? 0) > 0 ||
      (input.tapScriptSig?.length ?? 0) > 0,
  );
}

// Checks that what the wallet signed is what was built and shown. That each signature is valid is Bitcoin's to decide when the
// transaction is sent; this checks that every input carries one and that nothing else changed.
export function verifySignedClaim(
  chains: ReadonlyMap<ChainRef, ServedChain>,
  unsigned: UnsignedTransaction,
  signed: SignedTransaction,
): VerificationResult {
  if (
    signed.chain !== unsigned.chain ||
    signed.family !== unsigned.family ||
    signed.format !== unsigned.format ||
    unsigned.format !== psbtFormat
  ) {
    return { ok: false, reason: "payload-mismatch" };
  }
  const built = parse(unsigned.payload);
  const returned = parse(signed.payload);
  if (
    built === null ||
    returned === null ||
    !sameTransaction(built, returned)
  ) {
    return { ok: false, reason: "payload-mismatch" };
  }
  if (!matchesSummary(unsigned, built, chains))
    return { ok: false, reason: "summary-mismatch" };
  return isSigned(returned)
    ? { ok: true }
    : { ok: false, reason: "signature-invalid" };
}
