import type { AlkaneId } from "../node/alkane-id.ts";
import { gameRewardsOpcodes } from "../abi.ts";
import { callScript } from "./call-script.ts";

// Where the claim's result goes: output 0, which is also where the contract reads the claimant from.
const claimantOutput = 0;

// The `OP_RETURN` output of a claim: a call to `claim(milestone key)` on the game, whose collectible is sent to output 0.
export function claimScript(game: AlkaneId, milestoneKey: bigint): Uint8Array {
  return callScript(
    { inputs: [milestoneKey], opcode: gameRewardsOpcodes.claim, target: game },
    {
      pointer: claimantOutput,
      refund: claimantOutput,
      unallocated: claimantOutput,
    },
  );
}

export { claimantOutput };
