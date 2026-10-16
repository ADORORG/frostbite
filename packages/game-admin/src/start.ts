import { InvalidAddressError } from "@ador/chain/ports";
import type {
  Address,
  ContractRef,
  TransactionIntent,
  UnsignedTransaction,
} from "@ador/shared/chain";

import { toView } from "./steps.ts";
import type {
  AdminChainPorts,
  AdministeredGame,
  GameAdminDependencies,
  StartStepInput,
  StartStepResult,
} from "./types.ts";

type Ready = {
  readonly contract: ContractRef;
  readonly game: AdministeredGame;
  readonly ports: AdminChainPorts;
  readonly sender: Address;
};

// What is needed to build a step, or why it cannot be: the game is known and has a contract, its chain has an adapter that can
// build, and the wallet is an address on that chain.
function prepare(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
): Ready | Extract<StartStepResult, { ok: false; code: string }> {
  const game = dependencies.game(input.gameId);
  if (game === null) return { code: "not-administered", ok: false };
  const contract = game.contract;
  if (contract === null) return { code: "unavailable", ok: false };
  const ports = dependencies.ports(game.chain);
  if (ports === null) return { code: "unavailable", ok: false };
  try {
    return {
      contract,
      game,
      ports,
      sender: ports.addressCodec.parse(game.chain, input.wallet),
    };
  } catch (error) {
    if (error instanceof InvalidAddressError)
      return { code: "wrong-chain", ok: false };
    throw error;
  }
}

// The step's intent, from what staff asked for and what the game's manifest and contract say; or the reason it cannot be made.
function intentOf(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
  ready: Ready,
): TransactionIntent | Extract<StartStepResult, { ok: false }> {
  const { action } = input;
  const { game, sender } = ready;
  const base = {
    chain: game.chain,
    contract: ready.contract,
    sender,
    ...(input.authTokenOutput === undefined
      ? {}
      : { extension: { adminOutput: input.authTokenOutput } }),
  };
  if (action.operation === "set-claims-paused")
    return { ...base, operation: action.operation, paused: action.paused };
  const milestone = game.milestones.get(action.milestoneId);
  if (milestone === undefined) return { code: "not-administered", ok: false };
  if (action.drawing === undefined)
    return {
      ...base,
      claimLimit: milestone.claimLimit,
      milestoneId: action.milestoneId,
      operation: action.operation,
    };
  const drawing = dependencies.sanitise(action.drawing, game.maxDrawingBytes);
  if (!drawing.ok)
    return { code: "bad-drawing", ok: false, reason: drawing.detail };
  return {
    ...base,
    claimLimit: milestone.claimLimit,
    drawing: drawing.svg,
    milestoneId: action.milestoneId,
    operation: action.operation,
  };
}

// Builds the transaction for a step and stores it, awaiting staff's signature. Asking again for a step in progress returns it.
export async function startStep(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
): Promise<StartStepResult> {
  const ready = prepare(dependencies, input);
  if ("code" in ready) return ready;
  const intent = intentOf(dependencies, input, ready);
  if ("code" in intent) return intent;
  let unsigned: UnsignedTransaction;
  try {
    unsigned = await ready.ports.builder.build(
      intent,
      dependencies.funding(ready.game.chain),
    );
  } catch (error) {
    return {
      code: "could-not-build",
      ok: false,
      reason:
        error instanceof Error ? error.message : "The step could not be built.",
    };
  }
  const result = await dependencies.repository.create({
    chain: ready.game.chain,
    contract: ready.contract,
    createdAt: dependencies.clock(),
    createdBy: input.staffId,
    expiresAt: new Date(unsigned.summary.expiresAt),
    gameId: input.gameId,
    id: dependencies.newId(),
    milestoneId:
      input.action.operation === "define-milestone"
        ? input.action.milestoneId
        : null,
    operation: input.action.operation,
    unsigned,
  });
  if (result.kind === "already-defined")
    return { code: "already-defined", ok: false };
  return {
    ok: true,
    resumed: result.kind === "in-progress",
    step: toView(result.step),
  };
}
