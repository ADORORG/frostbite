import type { TransactionIntent } from "@ador/shared/chain";

import type { BitcoinAddress } from "../../bitcoin/address.ts";
import { gameRewardsOpcodes } from "../abi.ts";
import { fromHex } from "../node/hex.ts";
import { formatAlkaneId, type AlkaneId } from "../node/alkane-id.ts";
import type { AlkanesNode } from "../node/node.ts";
import { feeTargetFor, type TransactionOptions } from "../options.ts";
import { needsAuthToken, type AdminOperation } from "./action.ts";
import { StepRefusedError, type StepFunding } from "./types.ts";

const outpoint = /^([0-9a-f]{64}):(0|[1-9]\d{0,9})$/u;
const uint128Bytes = 16;

function littleEndian(bytes: Uint8Array): bigint {
  return bytes.reduceRight((sum, byte) => (sum << 8n) | BigInt(byte), 0n);
}

// The token a game asks for, as its contract names it.
async function authTokenOf(
  node: AlkanesNode,
  game: AlkaneId,
): Promise<AlkaneId> {
  const answer = await node.view(game, gameRewardsOpcodes.getAuthToken, []);
  if (!answer.ok || answer.data.length !== uint128Bytes * 2) {
    throw new StepRefusedError(
      "The game's contract did not name its auth token.",
    );
  }
  return {
    block: littleEndian(answer.data.subarray(0, uint128Bytes)),
    tx: littleEndian(answer.data.subarray(uint128Bytes)),
  };
}

const holdsToken = (
  held: Awaited<ReturnType<AlkanesNode["holdings"]>>,
  token: AlkaneId,
) =>
  held.alkanes.some(
    (alkane) =>
      alkane.id.block === token.block &&
      alkane.id.tx === token.tx &&
      alkane.amount > 0n,
  );

// The most outputs looked at when the wallet is searched for the token. A token sits on a small output made by the step that last moved
// it, so the smallest ones come first; a wallet with more than this many has been used for something other than this game.
const searchedOutputs = 40;

type Owned = Awaited<ReturnType<AlkanesNode["utxos"]>>;
type OwnedOutput = Owned[number];

// What staff typed for the token's output, trimmed, or null when they left it blank.
function named(intent: TransactionIntent): string | null {
  const text = intent.extension?.["adminOutput"];
  return typeof text === "string" && text.trim() !== "" ? text.trim() : null;
}

// Which of the staff wallet's outputs holds the game's auth token. Named by the caller when they know it (and then it must be the
// wallet's, confirmed, and hold the token); otherwise found by asking the indexer about the wallet's own outputs, so staff are never made
// to read a transaction id off a block explorer. Each refusal says which of the ways it can fail it was.
async function tokenOutput(
  node: AlkanesNode,
  owned: Owned,
  token: AlkaneId,
  typed: string | null,
): Promise<OwnedOutput> {
  if (typed !== null) {
    const match = outpoint.exec(typed);
    if (match === null) {
      throw new StepRefusedError(
        "The auth token output must be written as a transaction id, a colon and an output number (txid:vout). Clear it to have it found.",
      );
    }
    const chosen = owned.find(
      (utxo) => utxo.txid === match[1] && String(utxo.vout) === match[2],
    );
    if (chosen === undefined) {
      throw new StepRefusedError(
        "The auth token output you named is not one of this wallet's outputs. Clear it to have it found, or sign with the wallet that holds the token.",
      );
    }
    if (!chosen.confirmed) {
      throw new StepRefusedError(
        "The auth token output you named is not confirmed yet. Wait for the step that made it to confirm, then try again.",
      );
    }
    if (!holdsToken(await node.holdings(chosen.txid, chosen.vout), token)) {
      throw new StepRefusedError(
        `The output you named does not hold the game's auth token ${formatAlkaneId(token)}.`,
      );
    }
    return chosen;
  }
  const looked = [...owned]
    .sort((left, right) => Number(left.value - right.value))
    .slice(0, searchedOutputs);
  const holders = await Promise.all(
    looked.map(async (utxo) =>
      holdsToken(await node.holdings(utxo.txid, utxo.vout), token)
        ? utxo
        : null,
    ),
  );
  const found = holders.find((utxo): utxo is OwnedOutput => utxo !== null);
  if (found !== undefined) return found;
  // The indexer reads confirmed blocks only, so a token in an output that is still waiting for a block cannot be seen. A wallet with
  // outputs still waiting very likely has the step that moved the token among them.
  throw new StepRefusedError(
    owned.some((utxo) => !utxo.confirmed)
      ? `The game's auth token ${formatAlkaneId(token)} was not found on this wallet's confirmed outputs, and a step it sent is still waiting for a block. Wait for it to confirm, then try again.`
      : `None of this wallet's outputs holds the game's auth token ${formatAlkaneId(token)}. Sign with the wallet that created the game.`,
  );
}

// What a step is paid with: the confirmed outputs of the staff wallet (`sender`), less the one that holds the auth token, which is
// spent only as the token. The token's output is named by the caller (`extension.adminOutput`, "txid:vout") and checked three ways
// before it is trusted: the wallet owns it, it is confirmed, and the indexer says it holds the game's auth token.
export async function stepFunding(
  node: AlkanesNode,
  intent: TransactionIntent,
  operation: AdminOperation,
  game: AlkaneId | null,
  sender: BitcoinAddress,
  options: Pick<
    TransactionOptions,
    "changeDustSats" | "claimOutputSats" | "feeSpeeds" | "feeTargetBlocks"
  >,
): Promise<StepFunding> {
  const script = fromHex(sender.scriptHex);
  const owned = await node.utxos(sender.address);
  const base = {
    changeDustSats: options.changeDustSats,
    feeRate: await node.feeRate(feeTargetFor(options, intent.feeSpeed)),
    outputDustSats: options.claimOutputSats,
  };
  const funder = (utxos: typeof owned) => ({
    kind: sender.type,
    script,
    utxos,
  });
  if (!needsAuthToken(operation)) {
    return { ...base, admin: null, funder: funder(owned) };
  }
  if (game === null) {
    throw new StepRefusedError("This step needs a game, and none was named.");
  }
  const token = await authTokenOf(node, game);
  const found = await tokenOutput(node, owned, token, named(intent));
  return {
    ...base,
    admin: {
      kind: sender.type,
      script,
      txid: found.txid,
      value: found.value,
      vout: found.vout,
    },
    funder: funder(owned.filter((utxo) => utxo !== found)),
  };
}
