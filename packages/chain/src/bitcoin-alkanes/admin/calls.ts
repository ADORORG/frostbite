import type { AlkaneId } from "../node/alkane-id.ts";
import { collectibleOpcodes, gameRewardsOpcodes } from "../abi.ts";
import type { Call } from "../tx/call-script.ts";

// The calls that administer a game's reward contract and publish its code, as the contracts' ABI defines them (`abi.ts`). The block
// number of a target names what the call does with the id: 3 publishes code at `{4, id}` (`create`), 6 makes an instance of the
// code published at `{4, id}`.
const publishBlock = 3n;
const instanceBlock = 6n;

export function defineMilestoneCall(
  game: AlkaneId,
  milestoneKey: bigint,
  claimLimit: bigint,
): Call {
  return {
    inputs: [milestoneKey, claimLimit],
    opcode: gameRewardsOpcodes.defineMilestone,
    target: game,
  };
}

export function pauseCall(game: AlkaneId): Call {
  return { inputs: [], opcode: gameRewardsOpcodes.pause, target: game };
}

export function resumeCall(game: AlkaneId): Call {
  return { inputs: [], opcode: gameRewardsOpcodes.resume, target: game };
}

// A game is an instance of the game template, initialised in the same call; the auth token comes back to the caller.
export function createGameCall(
  gameTemplate: bigint,
  collectibleTemplate: bigint,
  maxArtBytes: bigint,
): Call {
  return {
    inputs: [collectibleTemplate, maxArtBytes],
    opcode: gameRewardsOpcodes.initialize,
    target: { block: instanceBlock, tx: gameTemplate },
  };
}

// Publishing code runs it once with the call's inputs, so a template is published with a read-only call that changes nothing;
// with no inputs the call would run `initialize` on the template itself.
export function publishTemplateCall(
  templateId: bigint,
  readOnlyOpcode: bigint,
): Call {
  return {
    inputs: [],
    opcode: readOnlyOpcode,
    target: { block: publishBlock, tx: templateId },
  };
}

export const templateReadOnlyOpcodes = {
  collectible: collectibleOpcodes.getName,
  gameRewards: gameRewardsOpcodes.getName,
} as const;
