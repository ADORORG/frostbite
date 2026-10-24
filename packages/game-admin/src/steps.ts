import { createDelayJudge, type IndexingPorts } from "@ador/chain/indexing";
import type { TransactionPart } from "@ador/chain/ports";
import {
  signedOf,
  type ChainRef,
  type DelayPolicy,
  type SignedTransaction,
} from "@ador/shared/chain";

import { isUnreadableCreation } from "./completion.ts";
import type { GameAdminDependencies, StoredStep, StepView } from "./types.ts";

const toView = (
  step: StoredStep,
  delayed: boolean,
  transactions: StepView["transactions"],
): StepView => ({
  createdAt: step.createdAt.toISOString(),
  createdBy: step.createdBy,
  createdContracts: step.createdContracts ?? [],
  delayed,
  expiresAt: step.expiresAt.toISOString(),
  failureReason: step.failureReason,
  gameId: step.gameId,
  id: step.id,
  milestoneId: step.milestoneId,
  operation: step.operation,
  recordable: isUnreadableCreation(step),
  recordedBy: step.recordedBy,
  sentAt: step.broadcastAt?.toISOString() ?? null,
  state: step.state,
  submittedBy: step.submittedBy,
  summary: step.unsigned.summary,
  templateRef: step.templateRef,
  toSign: step.state === "awaiting_signature" ? step.unsigned : null,
  transactionId: step.transactionId,
  transactions,
  // Sent, but the network has not been seen to hold it: the platform looks again and sends the same signed bytes again.
  unconfirmedSend: step.state === "broadcast_unknown",
});

// The viewer of a service whose dependencies are whole: the ids of a signed step come from its chain's own adapter.
export const stepViewerFor = (dependencies: GameAdminDependencies) =>
  createStepViewer({
    ...dependencies,
    transactionIds: (chain, signed) =>
      dependencies.ports(chain)?.builder.transactionIds(signed) ?? [],
  });

// How steps are told to staff and pages: each with whether its wait is delayed, judged against the chain's indexer as it is now.
export function createStepViewer(dependencies: {
  readonly clock: () => Date;
  readonly delay: DelayPolicy;
  readonly ports: IndexingPorts;
  // The ids of the transactions a signed step holds, from the chain's own adapter.
  transactionIds(
    chain: ChainRef,
    signed: SignedTransaction,
  ): readonly TransactionPart[];
}) {
  // The transactions a signed step holds, by id, so staff can follow each on a block explorer. None before it is signed.
  const partsOf = (step: StoredStep): StepView["transactions"] => {
    const signed = signedOf(step);
    return signed === null
      ? []
      : dependencies.transactionIds(step.chain, signed);
  };
  const judge = createDelayJudge({
    now: dependencies.clock,
    ports: dependencies.ports,
    policy: dependencies.delay,
  });
  const many = async (steps: readonly StoredStep[]): Promise<StepView[]> => {
    const delayed = await judge(steps);
    return steps.map((step, index) =>
      toView(step, delayed[index] === true, partsOf(step)),
    );
  };
  return {
    many,
    one: async (step: StoredStep): Promise<StepView> =>
      toView(step, (await judge([step]))[0] === true, partsOf(step)),
  };
}
