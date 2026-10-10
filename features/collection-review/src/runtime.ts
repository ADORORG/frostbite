import {
  createDrizzleSubmissionRepository,
  createReviewService,
} from "@ador/collections";
import { createDatabaseFromEnvironment } from "@ador/database/connection";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { createUuidV7 } from "@ador/shared/identifiers";

// Submissions waiting at once on the queue page; an engineering bound, not a product quota.
const queueLimit = 100;

export type ReviewServiceResolver = ReturnType<
  typeof createReviewServiceResolver
>;

// The review service, built on first use over one database client. A failed build is not cached.
export function createReviewServiceResolver(
  authorizationPolicy: AuthorizationPolicy,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () =>
    createReviewService({
      authorizationPolicy,
      clock: () => new Date(),
      createId: createUuidV7,
      queueLimit,
      repository: createDrizzleSubmissionRepository(
        createDatabaseFromEnvironment(environment),
      ),
    }),
  );
}
