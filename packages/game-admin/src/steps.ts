import { createDelayJudge, type IndexingPorts } from "@ador/chain/indexing";
import type { DelayPolicy } from "@ador/shared/chain";

import { isUnreadableCreation } from "./completion.ts";
import type { StoredStep, StepView } from "./types.ts";

const toView = (step: StoredStep, delayed: boolean): StepView => ({
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
});

// How steps are told to staff and pages: each with whether its wait is delayed, judged against the chain's indexer as it is now.
export function createStepViewer(dependencies: {
  readonly clock: () => Date;
  readonly delay: DelayPolicy;
  readonly ports: IndexingPorts;
}) {
  const judge = createDelayJudge({
    now: dependencies.clock,
    ports: dependencies.ports,
    policy: dependencies.delay,
  });
  const many = async (steps: readonly StoredStep[]): Promise<StepView[]> => {
    const delayed = await judge(steps);
    return steps.map((step, index) => toView(step, delayed[index] === true));
  };
  return {
    many,
    one: async (step: StoredStep): Promise<StepView> =>
      toView(step, (await judge([step]))[0] === true),
  };
}
