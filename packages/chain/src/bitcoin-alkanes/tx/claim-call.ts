import type { AlkaneId } from "../node/alkane-id.ts";
import { gameRewardsOpcodes } from "../abi.ts";
import { encipherProtostone, varintList } from "./protostone.ts";
import { runestoneScript } from "./runestone.ts";

// The protocol tag Alkanes registers (`alkanes-support`'s `AlkaneMessageContext::protocol_tag`).
const alkanesProtocolTag = 1n;
// Where the claim's result goes: output 0, which is also where the contract reads the claimant from.
const claimantOutput = 0;

// The `OP_RETURN` output of a claim: a call to `claim(milestone key)` on the game, whose collectible is sent to output 0.
export function claimScript(game: AlkaneId, milestoneKey: bigint): Uint8Array {
  const message = varintList([
    game.block,
    game.tx,
    gameRewardsOpcodes.claim,
    milestoneKey,
  ]);
  return runestoneScript(
    claimantOutput,
    encipherProtostone({
      message,
      pointer: claimantOutput,
      protocolTag: alkanesProtocolTag,
      refund: claimantOutput,
    }),
  );
}

export { claimantOutput };
