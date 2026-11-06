import type { DatabaseClient } from "@frostbite/database/connection";

import type { SubmissionRepository } from "../application/submission-repository.ts";
import { createDrizzleReview } from "./drizzle-review.ts";
import { createDrizzleAuthoring } from "./drizzle-submit.ts";

export function createDrizzleSubmissionRepository(
  database: DatabaseClient,
): SubmissionRepository {
  return {
    ...createDrizzleAuthoring(database),
    ...createDrizzleReview(database),
  };
}
