import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  creatorAdmissionEvents,
  creatorApplications,
  creatorApplicationSnapshots,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  runMigrations,
} from "@ador/database";
import type { AuthorizationPolicy } from "@ador/shared/accounts";
import type {
  CreatorApplicationDraft,
  CreatorReviewDecision,
} from "@ador/shared/creator-admission";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleCreatorAdmissionRepository } from "../../src/adapters/drizzle-repository.ts";
import { createCreatorAdmissionService } from "../../src/application/service.ts";

// A real database, the real repository and service, and the people a creator admission test needs.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: { reviewer: ["creator:review"], staff: ["platform:operate"] },
  version: "test-v1",
};
export const draft: CreatorApplicationDraft = {
  contentDeclarationAccepted: true,
  displayName: "Creator",
  expectedLaunchSize: "Small",
  expectedLaunchTiming: "After review",
  jurisdictionAcknowledged: true,
  portfolioLinks: [],
  projectSummary: "Summary",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};
export const service = createCreatorAdmissionService({
  authorizationPolicy: policy,
  clock: () => new Date(),
  createId: createUuidV7,
  repository: createDrizzleCreatorAdmissionRepository(database),
});

// Migrates once and empties the admission tables before each test.
export function useCreatorDatabase() {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    await database.delete(creatorAdmissionEvents);
    await database.delete(creatorApplicationSnapshots);
    await database.delete(creatorApplications);
    await database.delete(platformRoleAssignments);
    await database.delete(authUsers);
  });
  afterAll(async () => pool.end());
}

export async function user(role?: "reviewer") {
  const id = createUuidV7();
  await database.insert(authUsers).values({
    email: `${id}@example.test`,
    emailVerified: true,
    id,
    name: role ?? "Applicant",
  });
  if (role)
    await database.insert(platformRoleAssignments).values({
      id: createUuidV7(),
      role,
      status: "active",
      userId: id,
    });
  return id;
}

export function request(actorUserId: UuidV7, key: string) {
  return { actorUserId, correlationId: createUuidV7(), idempotencyKey: key };
}

export function decision(
  applicationId: CreatorReviewDecision["applicationId"],
  action: CreatorReviewDecision["action"],
  words: { creatorFeedback?: string; privateNotes?: string } = {},
): CreatorReviewDecision {
  return {
    action,
    applicationId,
    creatorFeedback: words.creatorFeedback ?? "",
    evidenceReferences: [],
    privateNotes: words.privateNotes ?? "",
    reasonCode: "feedback-test",
  };
}
