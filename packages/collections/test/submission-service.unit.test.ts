import { chainOptionSchema } from "@frostbite/shared/chain";
import { describe, expect, it } from "vitest";

import { createSubmissionService } from "../src/application/submission-service.ts";
import { newId, signet } from "./support/fixtures.ts";
import {
  fingerprintOf,
  recordingSubmissions,
} from "./support/recording-submissions.ts";

const fixedNow = new Date("2026-10-10T12:00:00.000Z");
const actor = newId();
const collection = newId();
const request = {
  actorUserId: actor,
  correlationId: "018f22f2-9c1a-7b21-8c45-0000000000aa",
  idempotencyKey: "request-key-00000001",
};
const chains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
  chainOptionSchema.parse({
    chainId: "eip155:1",
    displayName: "Disabled",
    enabled: false,
    family: "evm",
    role: "production",
  }),
];

function setup() {
  const recording = recordingSubmissions();
  const service = createSubmissionService({
    clock: () => fixedNow,
    createId: recording.createId,
    repository: recording.repository,
    targetChains: chains,
  });
  return { ...recording, service };
}

describe("submitting", () => {
  it("passes the clock, fresh ids, the enabled chains only, and a fingerprint of the request", async () => {
    const { calls, ids, service } = setup();
    const [eventId, submissionId] = ids;
    await service.submit(
      { collectionId: collection, expectedRevision: 3 },
      request,
    );
    expect(calls[0]?.method).toBe("submit");
    expect(calls[0]?.input).toMatchObject({
      actorUserId: actor,
      allowedChains: [signet],
      changedAt: fixedNow,
      collectionId: collection,
      eventId,
      expectedRevision: 3,
      idempotencyKey: request.idempotencyKey,
      policyVersion: "collection-review-beta-v1",
      submissionId,
    });
    expect(calls[0]?.input).toMatchObject({
      requestFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
  });

  it("derives a different fingerprint for a different revision, collection, or actor, and the same one for a retry", async () => {
    const send = async (
      input: { collectionId: typeof collection; expectedRevision: number },
      who: typeof actor,
    ) => {
      const { calls, service } = setup();
      await service.submit(input, { ...request, actorUserId: who });
      return fingerprintOf(calls[0]);
    };
    const base = { collectionId: collection, expectedRevision: 1 };
    const original = await send(base, actor);
    expect(await send(base, actor)).toBe(original);
    for (const other of [
      await send({ ...base, expectedRevision: 2 }, actor),
      await send({ ...base, collectionId: newId() }, actor),
      await send(base, newId()),
    ])
      expect(other).not.toBe(original);
  });

  it("rejects a malformed key, correlation id, or revision before touching the repository", async () => {
    const { calls, service } = setup();
    const input = { collectionId: collection, expectedRevision: 1 };
    expect(() =>
      service.submit(input, { ...request, idempotencyKey: "short" }),
    ).toThrow();
    expect(() =>
      service.submit(input, { ...request, correlationId: "nope" }),
    ).toThrow();
    expect(() =>
      service.submit({ ...input, expectedRevision: 0 }, request),
    ).toThrow();
    expect(calls).toEqual([]);
  });
});

describe("listing", () => {
  it("passes the owner's collection straight through", async () => {
    const { calls, service } = setup();
    await service.listForOwner({
      collectionId: collection,
      ownerUserId: actor,
    });
    expect(calls).toEqual([
      {
        input: { collectionId: collection, ownerUserId: actor },
        method: "listForOwner",
      },
    ]);
  });
});
