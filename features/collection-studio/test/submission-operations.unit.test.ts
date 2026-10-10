import type { SubmissionRecord, SubmitResult } from "@ador/collections";
import { describe, expect, it, vi } from "vitest";

import {
  createListSubmissionsOperation,
  createSubmitCollectionOperation,
  type SubmissionService,
} from "../src/application/submission-operations.ts";
import { presentSubmission } from "../src/application/present-submission.ts";
import { anonymous, context, id, userId } from "./support/stubs.ts";

const at = new Date("2026-10-10T12:00:00.000Z");
const collectionId = id();

const record = (
  overrides: Partial<SubmissionRecord> = {},
): SubmissionRecord => ({
  collectionId,
  collectionRevision: 3,
  createdAt: at,
  decisions: [],
  id: id(),
  ownerUserId: userId,
  payloadHash: "a".repeat(64),
  sequence: 1,
  state: "submitted",
  updatedAt: at,
  ...overrides,
});

function serviceReturning(
  result: SubmitResult,
  listed: readonly SubmissionRecord[] = [],
) {
  const submit = vi.fn(async () => result);
  const listForOwner = vi.fn(async () => listed);
  const service: SubmissionService = { listForOwner, submit };
  return { listForOwner, service, submit };
}

const input = { collectionId, expectedRevision: 3 };

describe("presenting a submission to its creator", () => {
  it("shows state, frozen revision and hash, and each decision with its feedback only", () => {
    const decided = record({
      decisions: [
        {
          action: "request-changes",
          createdAt: at,
          creatorFeedback: "Add a banner.",
          nextState: "changes-requested",
        },
      ],
      state: "changes-requested",
    });
    expect(presentSubmission(decided)).toEqual({
      collectionId,
      collectionRevision: 3,
      createdAt: at.toISOString(),
      decisions: [
        {
          action: "request-changes",
          createdAt: at.toISOString(),
          creatorFeedback: "Add a banner.",
          nextState: "changes-requested",
        },
      ],
      id: decided.id,
      payloadHash: "a".repeat(64),
      sequence: 1,
      state: "changes-requested",
      updatedAt: at.toISOString(),
    });
  });

  it("never carries the owner id, which the creator already knows and staff views own", () => {
    expect(Object.keys(presentSubmission(record()))).not.toContain(
      "ownerUserId",
    );
  });
});

describe("submit operation", () => {
  it("requires a session and the idempotency context without touching the service", async () => {
    const { service, submit } = serviceReturning({ kind: "not-found" });
    const operation = createSubmitCollectionOperation(async () => service);
    expect(await operation.execute(input, anonymous)).toMatchObject({
      error: "unauthorized",
      ok: false,
    });
    await expect(
      operation.execute(input, { ...context, idempotencyKey: undefined }),
    ).rejects.toThrow("Idempotency boundary missing");
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(["submitted", "replayed"] as const)(
    "returns the submission when it is %s",
    async (kind) => {
      const submission = record();
      const { service, submit } = serviceReturning({ kind, submission });
      const result = await createSubmitCollectionOperation(
        async () => service,
      ).execute(input, context);
      expect(result).toMatchObject({
        ok: true,
        value: { submission: { id: submission.id } },
      });
      expect(submit).toHaveBeenCalledWith(
        { collectionId, expectedRevision: 3 },
        {
          actorUserId: userId,
          correlationId: context.correlationId,
          idempotencyKey: context.idempotencyKey,
        },
      );
    },
  );

  it.each([
    [{ kind: "conflict" }, "conflict", "idempotency key conflicts"],
    [
      { kind: "not-ready", missing: ["description", "all-items"] },
      "invalid_request",
      "needs a description, every planned item",
    ],
    [
      { kind: "not-submittable", reason: "in-review" },
      "conflict",
      "already has a submission in review",
    ],
    [{ kind: "not-submittable", reason: "closed" }, "conflict", "was closed"],
    [
      { currentRevision: 9, kind: "revision-conflict" },
      "conflict",
      "changed since it was loaded",
    ],
    [
      { assetId: "x", kind: "invalid-asset" },
      "invalid_request",
      "processed upload",
    ],
    [{ kind: "invalid-chain" }, "invalid_request", "chain is not available"],
    [{ kind: "not-eligible" }, "forbidden", "approved creators"],
    [{ kind: "not-found" }, "not_found", "not found"],
  ] as const)("reports %j as %s", async (outcome, error, words) => {
    const { service } = serviceReturning(outcome);
    const result = await createSubmitCollectionOperation(
      async () => service,
    ).execute(input, context);
    expect(result).toMatchObject({ error, ok: false });
    expect(JSON.stringify(result)).toContain(words);
  });
});

describe("list submissions operation", () => {
  it("requires a session", async () => {
    const { listForOwner, service } = serviceReturning({ kind: "not-found" });
    const result = await createListSubmissionsOperation(
      async () => service,
    ).execute({ collectionId }, anonymous);
    expect(result).toMatchObject({ error: "unauthorized", ok: false });
    expect(listForOwner).not.toHaveBeenCalled();
  });

  it("lists only the caller's own collection, presented for the creator", async () => {
    const first = record({ sequence: 2 });
    const { listForOwner, service } = serviceReturning({ kind: "not-found" }, [
      first,
    ]);
    const result = await createListSubmissionsOperation(
      async () => service,
    ).execute({ collectionId }, context);
    expect(listForOwner).toHaveBeenCalledWith({
      collectionId,
      ownerUserId: userId,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { submissions: [{ id: first.id, sequence: 2 }] },
    });
  });
});
