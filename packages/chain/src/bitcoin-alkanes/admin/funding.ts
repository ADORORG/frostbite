import type { TransactionIntent } from "@ador/shared/chain";

import type { BitcoinAddress } from "../../bitcoin/address.ts";
import { gameRewardsOpcodes } from "../abi.ts";
import { fromHex } from "../node/hex.ts";
import { formatAlkaneId, type AlkaneId } from "../node/alkane-id.ts";
import type { AlkanesNode } from "../node/node.ts";
import type { TransactionOptions } from "../options.ts";
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
    "changeDustSats" | "claimOutputSats" | "feeTargetBlocks"
  >,
): Promise<StepFunding> {
  const script = fromHex(sender.scriptHex);
  const owned = await node.utxos(sender.address);
  const base = {
    changeDustSats: options.changeDustSats,
    feeRate: await node.feeRate(options.feeTargetBlocks),
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
  const named = intent.extension?.["adminOutput"];
  const match = typeof named === "string" ? outpoint.exec(named) : null;
  const found = owned.find(
    (utxo) =>
      match !== null &&
      utxo.txid === match[1] &&
      String(utxo.vout) === match[2],
  );
  if (game === null || found === undefined || !found.confirmed) {
    throw new StepRefusedError(
      "The output that holds the game's auth token is not one of the wallet's confirmed outputs.",
    );
  }
  const [held, token] = await Promise.all([
    node.holdings(found.txid, found.vout),
    authTokenOf(node, game),
  ]);
  if (
    !held.alkanes.some(
      (alkane) =>
        alkane.id.block === token.block &&
        alkane.id.tx === token.tx &&
        alkane.amount > 0n,
    )
  ) {
    throw new StepRefusedError(
      `The output does not hold the game's auth token ${formatAlkaneId(token)}.`,
    );
  }
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
