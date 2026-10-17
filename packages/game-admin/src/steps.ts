import type { StoredStep, StepView } from "./types.ts";

export const toView = (step: StoredStep): StepView => ({
  createdAt: step.createdAt.toISOString(),
  createdBy: step.createdBy,
  createdContracts: step.createdContracts ?? [],
  expiresAt: step.expiresAt.toISOString(),
  failureReason: step.failureReason,
  gameId: step.gameId,
  id: step.id,
  milestoneId: step.milestoneId,
  operation: step.operation,
  state: step.state,
  submittedBy: step.submittedBy,
  summary: step.unsigned.summary,
  templateRef: step.templateRef,
  toSign: step.state === "awaiting_signature" ? step.unsigned : null,
  transactionId: step.transactionId,
});
