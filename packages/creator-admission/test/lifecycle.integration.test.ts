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
import { createUuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleCreatorAdmissionRepository } from "../src/adapters/drizzle-repository.ts";
import { createCreatorAdmissionService } from "../src/application/service.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: { reviewer: ["creator:review"], staff: ["platform:operate"] },
  version: "test-v1",
};
const draft: CreatorApplicationDraft = {
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
const dependencies = {
  clock: () => new Date(),
  createId: createUuidV7,
  queuePageSize: 25,
  repository: createDrizzleCreatorAdmissionRepository(database),
};
const service = createCreatorAdmissionService({
  ...dependencies,
  authorizationPolicy: policy,
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(creatorAdmissionEvents);
  await database.delete(creatorApplicationSnapshots);
  await database.delete(creatorApplications);
  await database.delete(platformRoleAssignments);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function user(role?: "reviewer") {
  const id = createUuidV7();
  await database.insert(authUsers).values({
    email: `${id}@example.test`,
    emailVerified: true,
    id,
    name: role ?? "Applicant",
  });
  if (role) {
    await database.insert(platformRoleAssignments).values({
      id: createUuidV7(),
      role,
      status: "active",
      userId: id,
    });
  }
  return id;
}

function request(actorUserId: Awaited<ReturnType<typeof user>>, key: string) {
  return { actorUserId, correlationId: createUuidV7(), idempotencyKey: key };
}

function decision(
  applicationId: CreatorReviewDecision["applicationId"],
  action: CreatorReviewDecision["action"],
): CreatorReviewDecision {
  return {
    action,
    applicationId,
    creatorFeedback: "Lifecycle review",
    evidenceReferences: [],
    privateNotes: "Checked",
    reasonCode: "lifecycle-review",
  };
}

describe("creator admission lifecycle", () => {
  it("supports corrections, approval, suspension, reinstatement, and revocation", async () => {
    const applicant = await user();
    const reviewer = await user("reviewer");
    await service.saveDraft(draft, request(applicant, "draft-lifecycle-01"));
    await expect(
      service.saveDraft(
        { ...draft, displayName: "Revised" },
        request(applicant, "draft-lifecycle-02"),
      ),
    ).resolves.toMatchObject({ application: { revision: 2 } });
    await service.submit(request(applicant, "submit-lifecycle-01"));
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    let counter = 0;
    const review = (action: CreatorReviewDecision["action"]) =>
      service.review(
        decision(application.id, action),
        request(
          reviewer,
          `review-lifecycle-${String(++counter).padStart(2, "0")}`,
        ),
      );
    await review("start-review");
    await expect(review("request-changes")).resolves.toMatchObject({
      application: { state: "changes-requested" },
    });
    await service.saveDraft(draft, request(applicant, "draft-lifecycle-03"));
    await service.submit(request(applicant, "submit-lifecycle-02"));
    await review("start-review");
    await expect(review("approve")).resolves.toMatchObject({
      application: { state: "approved" },
    });
    await expect(review("suspend")).resolves.toMatchObject({
      application: { state: "suspended" },
    });
    await expect(review("reinstate")).resolves.toMatchObject({
      application: { state: "approved" },
    });
    await review("suspend");
    await expect(review("revoke")).resolves.toMatchObject({
      application: { state: "revoked" },
    });
    await expect(
      service.saveDraft(draft, request(applicant, "draft-lifecycle-05")),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("keeps rejected resubmission closed until its product decision is accepted", async () => {
    const applicant = await user();
    const reviewer = await user("reviewer");
    await service.saveDraft(draft, request(applicant, "draft-rejected-001"));
    await service.submit(request(applicant, "submit-rejected-01"));
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    await service.review(
      decision(application.id, "start-review"),
      request(reviewer, "review-rejected-01"),
    );
    await expect(
      service.review(
        decision(application.id, "reject"),
        request(reviewer, "review-rejected-02"),
      ),
    ).resolves.toMatchObject({ application: { state: "rejected" } });
    await expect(
      service.saveDraft(draft, request(applicant, "draft-rejected-002")),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("replays submissions and reviews without duplicating snapshots or events", async () => {
    const applicant = await user();
    const reviewer = await user("reviewer");
    const draftRequest = request(applicant, "draft-replay-0001");
    await service.saveDraft(draft, draftRequest);
    await expect(service.saveDraft(draft, draftRequest)).resolves.toMatchObject(
      {
        kind: "replayed",
      },
    );
    await expect(
      service.saveDraft({ ...draft, displayName: "Changed" }, draftRequest),
    ).resolves.toEqual({ kind: "conflict" });
    await expect(service.submit(draftRequest)).resolves.toEqual({
      kind: "conflict",
    });
    const thief = await user();
    await expect(
      service.saveDraft(draft, { ...draftRequest, actorUserId: thief }),
    ).resolves.toEqual({ kind: "conflict" });
    const submitRequest = request(applicant, "submit-replay-001");
    const concurrent = await Promise.all([
      service.submit(submitRequest),
      service.submit(submitRequest),
    ]);
    expect(concurrent.map(({ kind }) => kind).sort()).toEqual([
      "changed",
      "replayed",
    ]);
    await expect(service.submit(submitRequest)).resolves.toMatchObject({
      kind: "replayed",
    });
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    const reviewRequest = request(reviewer, "review-replay-001");
    await service.review(
      decision(application.id, "start-review"),
      reviewRequest,
    );
    await expect(
      service.review(decision(application.id, "start-review"), reviewRequest),
    ).resolves.toMatchObject({ kind: "replayed" });
    await expect(
      service.review(decision(application.id, "approve"), reviewRequest),
    ).resolves.toEqual({ kind: "conflict" });
    await expect(
      database.select().from(creatorApplicationSnapshots),
    ).resolves.toHaveLength(1);
    await expect(
      database.select().from(creatorAdmissionEvents),
    ).resolves.toHaveLength(3);
  });

  it("denies missing applications and a policy with no reviewer role", async () => {
    const actor = await user("reviewer");
    const missingApplicant = createUuidV7();
    await expect(
      dependencies.repository.findForApplicant(missingApplicant),
    ).resolves.toBeNull();
    await expect(
      dependencies.repository.submit({
        actorUserId: missingApplicant,
        changedAt: new Date(),
        correlationId: createUuidV7(),
        idempotencyKey: "submit-missing-001",
        policyVersion: "test-v1",
        requestFingerprint: "0".repeat(64),
        schemaVersion: 1,
      }),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(
      service.review(
        decision(createUuidV7(), "approve"),
        request(actor, "review-missing-001"),
      ),
    ).resolves.toEqual({ kind: "not-found" });
    const noReviewerService = createCreatorAdmissionService({
      ...dependencies,
      authorizationPolicy: { ...policy, platform: { reviewer: [], staff: [] } },
    });
    const applicant = await user();
    await service.saveDraft(draft, request(applicant, "draft-no-role-001"));
    await service.submit(request(applicant, "submit-no-role-01"));
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    await expect(
      noReviewerService.review(
        decision(application.id, "start-review"),
        request(actor, "review-no-role-01"),
      ),
    ).resolves.toEqual({ kind: "forbidden" });
  });

  it("rechecks reviewer assignment inside the decision transaction", async () => {
    const applicant = await user();
    const reviewer = await user("reviewer");
    await service.saveDraft(draft, request(applicant, "draft-revoked-role"));
    await service.submit(request(applicant, "submit-revoked-role"));
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    await service.review(
      decision(application.id, "start-review"),
      request(reviewer, "review-before-revoke"),
    );
    await database.update(platformRoleAssignments).set({ status: "suspended" });
    await expect(
      service.review(
        decision(application.id, "approve"),
        request(reviewer, "review-after-revoke"),
      ),
    ).resolves.toEqual({ kind: "forbidden" });
  });

  it("refuses review when no immutable submission snapshot exists", async () => {
    const applicant = await user();
    const reviewer = await user("reviewer");
    const applicationId = createUuidV7();
    await database.insert(creatorApplications).values({
      applicantUserId: applicant,
      draft,
      id: applicationId,
      state: "submitted",
    });
    await expect(
      service.review(
        decision(applicationId, "start-review"),
        request(reviewer, "review-missing-snapshot"),
      ),
    ).resolves.toEqual({ kind: "conflict" });
  });
});
