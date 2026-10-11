import type { AuthorizationPolicy } from "@ador/shared/accounts";
import type { CreatorApplicationDraft } from "@ador/shared/creator-admission";
import { createUuidV7 } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import type { CreatorAdmissionRepository } from "../src/application/repository.ts";
import { createCreatorAdmissionService } from "../src/application/service.ts";

const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: { reviewer: ["creator:review"], staff: ["platform:operate"] },
  version: "test-v1",
};
const draft: CreatorApplicationDraft = {
  contentDeclarationAccepted: true,
  displayName: "Creator",
  expectedLaunchSize: "Small beta",
  expectedLaunchTiming: "After review",
  jurisdictionAcknowledged: true,
  portfolioLinks: ["https://example.test/work"],
  projectSummary: "A complete project summary",
  provenanceDeclarationAccepted: true,
  rightsDeclarationAccepted: true,
};
const actorUserId = createUuidV7();
const applicationId = createUuidV7();
const request = {
  actorUserId,
  correlationId: createUuidV7(),
  idempotencyKey: "creator-request-0001",
};

function repository(): CreatorAdmissionRepository {
  return {
    findForApplicant: vi.fn().mockResolvedValue({
      applicantUserId: actorUserId,
      draft,
      id: applicationId,
      revision: 1,
      state: "draft",
    }),
    review: vi.fn().mockResolvedValue({ kind: "changed" }),
    saveDraft: vi.fn().mockResolvedValue({ kind: "changed" }),
    submit: vi.fn().mockResolvedValue({ kind: "changed" }),
  };
}

function service(storage: CreatorAdmissionRepository) {
  return createCreatorAdmissionService({
    authorizationPolicy: policy,
    clock: () => new Date("2026-09-09T08:00:00.000Z"),
    createId: () => applicationId,
    repository: storage,
  });
}

describe("creator admission service", () => {
  it("validates and saves a private draft with authoritative context", async () => {
    const storage = repository();
    await service(storage).saveDraft(draft, request);
    expect(storage.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        ...request,
        applicationId,
        changedAt: new Date("2026-09-09T08:00:00.000Z"),
        draft,
        policyVersion: "creator-admission-beta-v1",
        requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    );
  });

  it("rejects malformed drafts and idempotency keys before persistence", () => {
    const storage = repository();
    expect(() =>
      service(storage).saveDraft({ ...draft, displayName: "" }, request),
    ).toThrow();
    expect(() =>
      service(storage).saveDraft(draft, {
        ...request,
        idempotencyKey: "short",
      }),
    ).toThrow();
    expect(() =>
      service(storage).saveDraft(draft, {
        ...request,
        correlationId: "not-a-uuid",
      }),
    ).toThrow();
    expect(storage.saveDraft).not.toHaveBeenCalled();
  });

  it("validates a complete application before the locked submission", async () => {
    const storage = repository();
    await service(storage).submit(request);
    expect(storage.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        schemaVersion: 1,
      }),
    );
  });

  it("rejects incomplete submission declarations and reports a missing draft", async () => {
    const incomplete = repository();
    vi.mocked(incomplete.findForApplicant).mockResolvedValue({
      applicantUserId: actorUserId,
      draft: { ...draft, rightsDeclarationAccepted: false },
      feedback: null,
      id: applicationId,
      revision: 1,
      state: "draft",
    });
    await expect(service(incomplete).submit(request)).rejects.toThrow();
    const missing = repository();
    vi.mocked(missing.findForApplicant).mockResolvedValue(null);
    await expect(service(missing).submit(request)).resolves.toEqual({
      kind: "not-found",
    });
  });

  it("validates reviews and derives reviewer roles from policy", async () => {
    const storage = repository();
    await service(storage).review(
      {
        action: "approve",
        applicationId,
        creatorFeedback: "Approved",
        evidenceReferences: ["https://example.test/evidence"],
        privateNotes: "Checked",
        reasonCode: "meets-policy",
      },
      request,
    );
    expect(storage.review).toHaveBeenCalledWith(
      expect.objectContaining({ allowedReviewerRoles: ["reviewer"] }),
    );
    expect(() =>
      service(storage).review(
        {
          action: "approve",
          applicationId,
          creatorFeedback: "",
          evidenceReferences: [],
          privateNotes: "",
          reasonCode: "INVALID CODE",
        },
        request,
      ),
    ).toThrow();
  });

  it("binds idempotency fingerprints to operation and validated payload", async () => {
    const storage = repository();
    const admission = service(storage);
    await admission.saveDraft(draft, request);
    await admission.submit(request);
    await admission.review(
      {
        action: "approve",
        applicationId,
        creatorFeedback: "Approved",
        evidenceReferences: [],
        privateNotes: "",
        reasonCode: "meets-policy",
      },
      request,
    );
    const draftFingerprint = vi.mocked(storage.saveDraft).mock.calls[0]?.[0]
      .requestFingerprint;
    const submitFingerprint = vi.mocked(storage.submit).mock.calls[0]?.[0]
      .requestFingerprint;
    const reviewFingerprint = vi.mocked(storage.review).mock.calls[0]?.[0]
      .requestFingerprint;
    expect(
      new Set([draftFingerprint, submitFingerprint, reviewFingerprint]).size,
    ).toBe(3);
  });
});
