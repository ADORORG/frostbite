import type { ChainOption } from "@ador/shared/chain";
import { submitCollectionInputSchema } from "@ador/shared/collections";
import type { UuidV7 } from "@ador/shared/identifiers";

import { mutationContext, type RequestContext } from "./submission-context.ts";
import type {
  SubmissionAuthoring,
  SubmissionRecord,
  SubmitResult,
} from "./submission-repository.ts";

export interface SubmissionServiceDependencies {
  readonly clock: () => Date;
  readonly createId: () => UuidV7;
  readonly repository: SubmissionAuthoring;
  readonly targetChains: readonly ChainOption[];
}

// A creator freezing their collection for review. The repository owns every invariant that depends on
// stored state (eligibility, readiness, one live submission, the frozen content).
export function createSubmissionService(
  dependencies: SubmissionServiceDependencies,
) {
  const allowedChains = dependencies.targetChains
    .filter(({ enabled }) => enabled)
    .map(({ chainId }) => chainId);
  return {
    listForOwner(input: {
      readonly collectionId: UuidV7;
      readonly ownerUserId: UuidV7;
    }): Promise<readonly SubmissionRecord[]> {
      return dependencies.repository.listForOwner(input);
    },

    submit(
      input: {
        readonly collectionId: UuidV7;
        readonly expectedRevision: number;
      },
      request: RequestContext,
    ): Promise<SubmitResult> {
      const parsed = submitCollectionInputSchema.parse(input);
      return dependencies.repository.submit({
        ...mutationContext(dependencies, request, "submit", parsed),
        allowedChains,
        collectionId: input.collectionId,
        expectedRevision: parsed.expectedRevision,
        submissionId: dependencies.createId(),
      });
    },
  };
}
