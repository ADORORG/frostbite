import { createHash } from "node:crypto";

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
import {
  creatorApplicationSubmissionSchema,
  type CreatorApplicationDraft,
} from "@frostbite/shared/creator-admission";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleCreatorAdmissionRepository } from "../src/adapters/drizzle-repository.ts";
import { createCreatorAdmissionService } from "../src/application/service.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: {
    admin: [],
    reviewer: ["creator:review"],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
  version: "test-v1",
};
const draft: CreatorApplicationDraft = {
  contentDeclarationAccepted: true,
  displayName: "Creator",
  expectedLaunchSize: "Small beta",
  expectedLaunchTiming: "After review",
  jurisdictionAcknowledged: true,
  portfolioLinks: ["https://example.test/work"],
  projectSummary: "A complete creator application.",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};
let tick = 0;

const service = createCreatorAdmissionService({
  authorizationPolicy: policy,
  clock: () => new Date(1_788_940_800_000 + tick++),
  createId: createUuidV7,
  queuePageSize: 25,
  repository: createDrizzleCreatorAdmissionRepository(database),
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(creatorAdmissionEvents);
  await database.delete(creatorApplicationSnapshots);
  await database.delete(creatorApplications);
  await database.delete(platformRoleAssignments);
  await database.delete(authUsers);
  tick = 0;
});
afterAll(async () => pool.end());

async function user(name: string, emailVerified: boolean) {
  const id = createUuidV7();
  await database.insert(authUsers).values({
    email: `${id}@example.test`,
    emailVerified,
    id,
    name,
  });
  return id;
}

function request(actorUserId: Awaited<ReturnType<typeof user>>, key: string) {
  return {
    actorUserId,
    correlationId: createUuidV7(),
    idempotencyKey: key,
  };
}

async function submittedApplicant() {
  const applicant = await user("Applicant", true);
  await service.saveDraft(draft, request(applicant, "draft-request-0001"));
  await service.submit(request(applicant, "submit-request-0001"));
  return applicant;
}

async function reviewer() {
  const id = await user("Reviewer", true);
  await database.insert(platformRoleAssignments).values({
    id: createUuidV7(),
    role: "reviewer",
    status: "active",
    userId: id,
  });
  return id;
}

describe("creator admission persistence", () => {
  it("saves, submits, snapshots, and preserves submitted evidence", async () => {
    const applicant = await user("Applicant", true);
    const saved = await service.saveDraft(
      draft,
      request(applicant, "draft-request-0001"),
    );
    expect(saved.kind).toBe("changed");
    const submitted = await service.submit(
      request(applicant, "submit-request-0001"),
    );
    expect(submitted).toMatchObject({
      application: { state: "submitted" },
      kind: "changed",
    });
    await expect(
      service.saveDraft(
        { ...draft, displayName: "Mutated" },
        request(applicant, "draft-request-0002"),
      ),
    ).resolves.toEqual({ kind: "conflict" });
    const [snapshot] = await database
      .select()
      .from(creatorApplicationSnapshots);
    expect(snapshot).toMatchObject({
      payload: draft,
      schemaVersion: 1,
      sequence: 1,
      verifiedContactEmail: `${applicant}@example.test`,
    });
    expect(snapshot?.payloadHash).toBe(
      createHash("sha256").update(JSON.stringify(draft)).digest("hex"),
    );
  });

  it("fails closed when verified contact evidence is absent", async () => {
    const applicant = await user("Applicant", false);
    await service.saveDraft(draft, request(applicant, "draft-request-0001"));
    await expect(
      service.submit(request(applicant, "submit-request-0001")),
    ).resolves.toEqual({ kind: "contact-unverified" });
    await expect(
      database.select().from(creatorApplicationSnapshots),
    ).resolves.toHaveLength(0);
  });

  it("rechecks reviewer authority, prevents self-review, and enforces transitions", async () => {
    const applicant = await submittedApplicant();
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    const decision = {
      action: "start-review" as const,
      applicationId: application.id,
      creatorFeedback: "",
      evidenceReferences: [],
      privateNotes: "Assigned",
      reasonCode: "review-started",
    };
    await expect(
      service.review(decision, request(applicant, "review-request-0001")),
    ).resolves.toEqual({ kind: "forbidden" });
    const unauthorized = await user("Outsider", true);
    await expect(
      service.review(decision, request(unauthorized, "review-request-0002")),
    ).resolves.toEqual({ kind: "forbidden" });
    const reviewerId = await reviewer();
    await expect(
      service.review(decision, request(reviewerId, "review-request-0003")),
    ).resolves.toMatchObject({
      application: { state: "under-review" },
      kind: "changed",
    });
    await expect(
      service.review(decision, request(reviewerId, "review-request-0004")),
    ).resolves.toEqual({ kind: "conflict" });
  });

  it("approves only while contact remains verified and stores private review fields", async () => {
    const applicant = await submittedApplicant();
    const reviewerId = await reviewer();
    const application = await service.findMine(applicant);
    if (application === null) throw new Error("Expected application");
    const base = {
      applicationId: application.id,
      creatorFeedback: "Ready for creator access",
      evidenceReferences: ["https://example.test/evidence"],
      privateNotes: "Internal evidence checked",
      reasonCode: "meets-policy",
    };
    await service.review(
      { ...base, action: "start-review" },
      request(reviewerId, "review-request-0001"),
    );
    await database.update(authUsers).set({ emailVerified: false });
    await expect(
      service.review(
        { ...base, action: "approve" },
        request(reviewerId, "review-request-0002"),
      ),
    ).resolves.toEqual({ kind: "contact-unverified" });
    await database.update(authUsers).set({ emailVerified: true });
    await expect(
      service.review(
        { ...base, action: "approve" },
        request(reviewerId, "review-request-0003"),
      ),
    ).resolves.toMatchObject({
      application: { state: "approved" },
      kind: "changed",
    });
    const events = await database.select().from(creatorAdmissionEvents);
    expect(events.at(-1)).toMatchObject({
      creatorFeedback: base.creatorFeedback,
      evidenceReferences: base.evidenceReferences,
      privateNotes: base.privateNotes,
    });
  });

  it("serializes concurrent submissions to one immutable snapshot", async () => {
    const applicant = await user("Applicant", true);
    await service.saveDraft(draft, request(applicant, "draft-request-0001"));
    const results = await Promise.all([
      service.submit(request(applicant, "submit-concurrent-01")),
      service.submit(request(applicant, "submit-concurrent-02")),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "changed",
      "conflict",
    ]);
    await expect(
      database.select().from(creatorApplicationSnapshots),
    ).resolves.toHaveLength(1);
  });

  it("keeps a concurrent draft save and snapshot hash consistent", async () => {
    const applicant = await user("Applicant", true);
    await service.saveDraft(draft, request(applicant, "draft-request-0001"));
    const revised = { ...draft, displayName: "Concurrent revision" };
    await Promise.all([
      service.saveDraft(revised, request(applicant, "draft-concurrent-01")),
      service.submit(request(applicant, "submit-concurrent-01")),
    ]);
    const [snapshot] = await database
      .select()
      .from(creatorApplicationSnapshots);
    if (snapshot === undefined) throw new Error("Expected snapshot");
    expect(snapshot.payloadHash).toBe(
      createHash("sha256")
        .update(
          JSON.stringify(
            creatorApplicationSubmissionSchema.parse(snapshot.payload),
          ),
        )
        .digest("hex"),
    );
  });

  it("serializes first-draft creation and replays a concurrent duplicate", async () => {
    const applicant = await user("Applicant", true);
    const sameRequest = request(applicant, "draft-concurrent-replay");
    const results = await Promise.all([
      service.saveDraft(draft, sameRequest),
      service.saveDraft(draft, sameRequest),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "changed",
      "replayed",
    ]);
    await expect(
      database.select().from(creatorApplications),
    ).resolves.toHaveLength(1);
    await expect(
      database.select().from(creatorAdmissionEvents),
    ).resolves.toHaveLength(1);
  });
});
