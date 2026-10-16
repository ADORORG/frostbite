import { initEccLib, payments } from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";

import { pushChunks, pushData, readPushes } from "../tx/script.ts";

// The data an Alkane reads from a transaction's witness (`alkanes-support`'s `RawEnvelope`): a tapscript that checks the key's
// signature and then holds the data inside a never-run branch, `OP_FALSE OP_IF "BIN" <empty> <data pushes> OP_ENDIF`. The data
// is committed to by paying to the taproot address of that script, and revealed by spending it.
const opChecksig = 0xac;
const opFalse = 0x00;
const opIf = 0x63;
const opEndif = 0x68;
const protocolId = new TextEncoder().encode("BIN");
// The first push after the protocol id is empty (the body tag); readers skip it.
const bodyTag = new Uint8Array();
// The version byte of a BIP 342 tapscript leaf.
export const tapscriptLeafVersion = 0xc0;

export interface Envelope {
  readonly controlBlock: Uint8Array;
  // The tapscript itself.
  readonly script: Uint8Array;
  // The script the commit output is locked to (a taproot output).
  readonly output: Uint8Array;
}

export function envelopeScript(
  xOnlyKey: Uint8Array,
  data: Uint8Array,
): Uint8Array {
  return Uint8Array.from([
    ...pushData(xOnlyKey),
    opChecksig,
    opFalse,
    opIf,
    ...pushData(protocolId),
    ...pushData(bodyTag),
    ...pushChunks(data),
    opEndif,
  ]);
}

// The commit output for `data`, spendable by the key `xOnlyKey` through the script path (and, because the key is also the internal
// key, by that key alone).
export function createEnvelope(
  xOnlyKey: Uint8Array,
  data: Uint8Array,
): Envelope {
  initEccLib(ecc);
  const script = envelopeScript(xOnlyKey, data);
  const taproot = payments.p2tr({
    internalPubkey: xOnlyKey,
    redeem: { output: script, redeemVersion: tapscriptLeafVersion },
    scriptTree: { output: script },
  });
  const witness = taproot.witness;
  const controlBlock = witness?.[witness.length - 1];
  if (taproot.output === undefined || controlBlock === undefined) {
    throw new Error("The commit output could not be made.");
  }
  return { controlBlock, output: taproot.output, script };
}

// The data an envelope script holds, or null if the script is not one `envelopeScript` makes (the key, the data and the script as a
// whole must match, byte for byte).
export function envelopeData(script: Uint8Array): Uint8Array | null {
  const keyLength = 32;
  const pushedKey = readPushes(script, 0, opChecksig);
  const key = pushedKey?.pushes[0];
  if (
    key === undefined ||
    key.length !== keyLength ||
    pushedKey?.pushes.length !== 1
  ) {
    return null;
  }
  const dataStart = 1 + keyLength + 1 + 1 + 1;
  const read = readPushes(script, dataStart, opEndif);
  const [protocol, body, ...chunks] = read?.pushes ?? [];
  if (
    read === null ||
    protocol === undefined ||
    body === undefined ||
    protocol.join() !== protocolId.join() ||
    body.length !== 0
  ) {
    return null;
  }
  const data = Uint8Array.from(chunks.flatMap((chunk) => [...chunk]));
  const rebuilt = envelopeScript(key, data);
  return rebuilt.length === script.length &&
    rebuilt.every((byte, index) => byte === script[index])
    ? data
    : null;
}
