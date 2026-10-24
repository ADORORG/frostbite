import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { collectionReviewCapability } from "@ador/shared/collections";
import { describe, expect, it } from "vitest";

import { createReviewService } from "../src/application/review-service.ts";
import { newId } from "./support/fixtures.ts";
import { recordingSubmissions } from "./support/recording-submissions.ts";

const actor = newId();
const submission = newId();
const request = {
  actorUserId: actor,
  correlationId: "018f22f2-9c1a-7b21-8c45-0000000000aa",
  idempotencyKey: "request-key-00000001",
};
const policy: AuthorizationPolicy = {
  organization: { admin: [], analyst: [], editor: [], owner: [] },
  platform: {
    admin: [],
    reviewer: [collectionReviewCapability],
    staff: ["platform:operate"],
  },
  requiredMethods: {},
  version: "test-v1",
};

function setup(authorizationPolicy: AuthorizationPolicy = policy) {
  const recording = recordingSubmissions();
  const service = createReviewService({
    authorizationPolicy,
    clock: () => new Date("2026-10-10T12:00:00.000Z"),
    createId: recording.createId,
    activityLimit: 40,
    queueLimit: 50,
    repository: recording.repository,
  });
  return { ...recording, service };
}

const decision = {
  action: "approve",
  creatorFeedback: "",
  privateNotes: "",
  reasonCode: "meets-policy",
  submissionId: submission,
} as const;

describe("deciding", () => {
  it("allows exactly the roles the policy gives the review capability", async () => {
    const { calls, service } = setup();
    await service.decide(decision, request);
    expect(calls[0]?.input).toMatchObject({
      action: "approve",
      allowedReviewerRoles: ["reviewer"],
      submissionId: submission,
    });
    const nobody = setup({
      ...policy,
      platform: { admin: [], reviewer: [], staff: [] },
    });
    await nobody.service.decide(decision, request);
    expect(nobody.calls[0]?.input).toMatchObject({ allowedReviewerRoles: [] });
  });

  it("refuses a decision that needs feedback and has none, before the repository", async () => {
    const { calls, service } = setup();
    expect(() =>
      service.decide({ ...decision, action: "reject" }, request),
    ).toThrow();
    expect(calls).toEqual([]);
  });

  it("fingerprints the decision, so the same key with another decision is recognised as different", async () => {
    const sent = async (action: "approve" | "start-review") => {
      const { calls, service } = setup();
      await service.decide({ ...decision, action }, request);
      return JSON.stringify(calls[0]?.input);
    };
    expect(await sent("approve")).not.toBe(await sent("start-review"));
  });
});

describe("activity", () => {
  it("passes the cursor and the page size straight through", async () => {
    const { calls, service } = setup();
    const cursor = {
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
      id: newId(),
    };
    await service.activity(cursor);
    await service.activity(null);
    expect(calls.map(({ input, method }) => [method, input])).toEqual([
      ["activity", { cursor, limit: 40 }],
      ["activity", { cursor: null, limit: 40 }],
    ]);
  });
});

describe("reading", () => {
  it("passes the queue bound and states, and the submission id, straight through", async () => {
    const { calls, service } = setup();
    await service.queue(["submitted"]);
    await service.readForReview(submission);
    expect(calls.map(({ input, method }) => [method, input])).toEqual([
      ["queue", { limit: 50, states: ["submitted"] }],
      ["readForReview", { id: submission }],
    ]);
  });
});
