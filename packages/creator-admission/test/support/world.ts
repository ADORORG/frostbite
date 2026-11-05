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
} from "@frostbite/database";
import type { AuthorizationPolicy } from "@frostbite/shared/accounts";
import type {
  CreatorApplicationDraft,
  CreatorReviewDecision,
} from "@frostbite/shared/creator-admission";
import { createUuidV7, type UuidV7 } from "@frostbite/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleCreatorAdmissionRepository } from "../../src/adapters/drizzle-repository.ts";
import { createCreatorAdmissionService } from "../../src/application/service.ts";

// A real database, the real repository and service, and the people a creator admission test needs.
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: {
    admin: [],
    reviewer: ["creator:review"],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
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
// The moment the service believes it is, which a test can set to make times and their order exact.
export const clock = { now: new Date() };
export function at(iso: string) {
  clock.now = new Date(iso);
}
export const service = createCreatorAdmissionService({
  authorizationPolicy: policy,
  clock: () => clock.now,
  createId: createUuidV7,
  queuePageSize: 3,
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

// Idempotency keys are at least sixteen characters; a short label is padded so the same label is the same key.
export function request(actorUserId: UuidV7, key: string) {
  return {
    actorUserId,
    correlationId: createUuidV7(),
    idempotencyKey: key.padEnd(16, "-"),
  };
}

// An applicant who sent an application under `name` at `when`, ready for review.
export async function sentApplication(name: string, when: string, key: string) {
  const applicant = await user();
  at(when);
  await service.saveDraft(
    { ...draft, displayName: name },
    request(applicant, `draft-${key}`),
  );
  await service.submit(request(applicant, `submit-${key}`));
  const mine = await service.findMine(applicant);
  if (mine === null) throw new Error("Expected application");
  return { applicant, id: mine.id };
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
