import { creatorApplications, platformRoleAssignments } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it } from "vitest";

import { createCreatorAdmissionService } from "../src/application/service.ts";
import {
  database,
  decision,
  dependencies,
  draft,
  policy,
  registerAdmissionDatabase,
  request,
  service,
  user,
} from "./support/admission-database.ts";

registerAdmissionDatabase();

describe("creator admission refusals", () => {
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
