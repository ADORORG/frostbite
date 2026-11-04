import type { UnsignedTransaction } from "@ador/shared/chain";
import { maxAdminPayloadChars } from "@ador/shared/games";

import {
  planDeploy,
  planGameStep,
  planPublish,
  type Plan,
  type Refusal,
} from "./plan.ts";
import { stepViewerFor } from "./steps.ts";
import type {
  GameAdminDependencies,
  StartStepInput,
  StartStepResult,
} from "./types.ts";

// What staff asked for, as a plan or the reason it cannot be done. A step on a game names the game; publishing a template does not.
function plan(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
): Promise<Plan | Refusal> {
  const { action, gameId } = input;
  if (action.operation === "publish-template")
    return gameId === null
      ? planPublish(dependencies, input, action)
      : Promise.resolve({ code: "not-administered", ok: false });
  return gameId === null
    ? Promise.resolve({ code: "not-administered", ok: false })
    : action.operation === "deploy"
      ? planDeploy(dependencies, { ...input, gameId }, action)
      : planGameStep(dependencies, { ...input, gameId }, action);
}

// Builds the transaction for a step and stores it, awaiting staff's signature. Asking again for a step in progress returns it.
export async function startStep(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
): Promise<StartStepResult> {
  const planned = await plan(dependencies, input);
  if ("ok" in planned) return planned;
  let unsigned: UnsignedTransaction;
  try {
    unsigned = await planned.ports.builder.build(
      input.feeSpeed === undefined
        ? planned.intent
        : { ...planned.intent, feeSpeed: input.feeSpeed },
      dependencies.funding(planned.chain),
    );
  } catch (error) {
    return {
      code: "could-not-build",
      ok: false,
      ...(error instanceof Error ? { reason: error.message } : {}),
    };
  }
  // What the platform cannot keep is refused here, in words, rather than failing as it is stored.
  if (unsigned.payload.length > maxAdminPayloadChars)
    return {
      code: "could-not-build",
      ok: false,
      reason: `The step's transaction is ${unsigned.payload.length} characters, more than the ${maxAdminPayloadChars} the platform keeps, which is the most Bitcoin nodes relay.`,
    };
  const result = await dependencies.repository.create({
    chain: planned.chain,
    contract: planned.contract,
    createdAt: dependencies.clock(),
    createdBy: input.staffId,
    expiresAt: new Date(unsigned.summary.expiresAt),
    gameId: planned.gameId,
    id: dependencies.newId(),
    milestoneId: planned.milestoneId,
    operation: input.action.operation,
    templateRef: planned.templateRef,
    unsigned,
  });
  if (result.kind === "already-defined")
    return { code: "already-defined", ok: false };
  return {
    ok: true,
    resumed: result.kind === "in-progress",
    step: await stepViewerFor(dependencies).one(result.step),
  };
}
