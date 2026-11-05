import { collectionSubmissions } from "@frostbite/database";
import { requestFingerprint } from "@frostbite/shared/http";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import { eq } from "drizzle-orm";

import {
  database,
  repository,
  seedAsset,
  seedReviewer,
  seedUser,
  submissions,
} from "./database.ts";
import { draft, itemFor, key, mutation, newId, now } from "./fixtures.ts";

export const allowedChains = [draft().targetChain];
export const reviewerRoles = ["reviewer"] as const;

// A creator with a collection that satisfies every submission requirement: a cover image, a
// description, and as many items as its planned supply.
export async function readyCollection(
  plannedSupply = 2,
  existingOwner?: UuidV7,
) {
  const owner = existingOwner ?? (await seedUser());
  const cover = await seedAsset(owner, "collection-artwork");
  const created = await repository.create({
    ...mutation(owner),
    collectionId: newId(),
    draft: draft({ coverAssetId: cover, plannedSupply }),
  });
  if (created.kind !== "created") throw new Error(`got ${created.kind}`);
  const collectionId = created.aggregate.collection.id;
  let revision = created.aggregate.collection.revision;
  for (let index = 0; index < plannedSupply; index += 1) {
    const image = await seedAsset(owner, "collection-item-artwork");
    const added = await repository.addItem({
      ...mutation(owner),
      collectionId,
      item: itemFor(image, { name: `Item ${String(index + 1)}` }),
      itemId: newId(),
      itemLimit: 100,
    });
    if (added.kind !== "added") throw new Error(`got ${added.kind}`);
    revision = added.revision;
  }
  return { collectionId, cover, ownerUserId: owner, revision };
}

type Ready = Awaited<ReturnType<typeof readyCollection>>;

// Every call gets its own key and fingerprint, as separate requests do; a test that wants a retry
// passes the same context twice.
export const submitContext = (actor: UuidV7) => ({
  actorUserId: actor,
  changedAt: now,
  correlationId: newId(),
  eventId: newId(),
  idempotencyKey: key(),
  policyVersion: "collection-review-beta-v1",
  requestFingerprint: requestFingerprint({ request: key() }),
});

export function submit(
  ready: Ready,
  overrides: Partial<Parameters<typeof submissions.submit>[0]> = {},
) {
  return submissions.submit({
    ...submitContext(ready.ownerUserId),
    allowedChains,
    collectionId: ready.collectionId,
    expectedRevision: ready.revision,
    submissionId: newId(),
    ...overrides,
  });
}

export async function submitted(ready?: Ready) {
  const target = ready ?? (await readyCollection());
  const result = await submit(target);
  if (result.kind !== "submitted") throw new Error(`got ${result.kind}`);
  return { ...target, submission: result.submission };
}

export function decide(
  submissionId: UuidV7,
  actor: UuidV7,
  action: Parameters<typeof submissions.decide>[0]["action"],
  overrides: Partial<Parameters<typeof submissions.decide>[0]> = {},
) {
  return submissions.decide({
    ...submitContext(actor),
    action,
    allowedReviewerRoles: reviewerRoles,
    creatorFeedback: "",
    privateNotes: "",
    reasonCode: "reviewed-by-staff",
    submissionId,
    ...overrides,
  });
}

export async function reviewerDecides(
  submissionId: UuidV7,
  action: Parameters<typeof decide>[2],
  overrides: Parameters<typeof decide>[3] = {},
) {
  return decide(submissionId, await seedReviewer(), action, overrides);
}

export async function rowOf(submissionId: UuidV7) {
  const [row] = await database
    .select()
    .from(collectionSubmissions)
    .where(eq(collectionSubmissions.id, submissionId));
  if (row === undefined) throw new Error("no such submission");
  return row;
}

// A submission taken through review to approval, with the time the approval was recorded.
export async function approvedSubmission() {
  const seeded = await submitted();
  const reviewer = await seedReviewer();
  await decide(seeded.submission.id, reviewer, "start-review");
  const result = await decide(seeded.submission.id, reviewer, "approve");
  if (result.kind !== "decided") throw new Error(`got ${result.kind}`);
  return { ...seeded, reviewer };
}
