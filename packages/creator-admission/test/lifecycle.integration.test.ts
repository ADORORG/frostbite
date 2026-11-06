import {
  creatorAdmissionEvents,
  creatorApplicationSnapshots,
} from "@frostbite/database";
import type { CreatorReviewDecision } from "@frostbite/shared/creator-admission";
import { describe, expect, it } from "vitest";

import {
  database,
  decision,
  draft,
  registerAdmissionDatabase,
  request,
  service,
  user,
} from "./support/admission-database.ts";

registerAdmissionDatabase();

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
});
