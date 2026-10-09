import { creatorApplications } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  repository,
  seedAsset,
  seedUser,
  useCollectionDatabase,
} from "./support/database.ts";
import { lockCreation } from "../src/adapters/guards.ts";
import { draft, itemFor, mutation, newId, now } from "./support/fixtures.ts";
import { seeded } from "./support/items.ts";

useCollectionDatabase();

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

// Suspends the creator in a transaction that stays open until `commit` is called, and resolves once
// the suspension (and its row lock) is in place.
async function holdSuspension(userId: string) {
  let commit: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    commit = resolve;
  });
  let locked: () => void = () => undefined;
  const lockTaken = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const finished = database.transaction(async (transaction) => {
    await transaction
      .update(creatorApplications)
      .set({ state: "suspended" })
      .where(eq(creatorApplications.applicantUserId, userId));
    locked();
    await held;
  });
  await lockTaken;
  return { commit, finished };
}

type Seed = Awaited<ReturnType<typeof seeded>>;

// A change must not slip past a suspension that is in flight: the change waits for it, then sees it.
describe("a suspension racing a change", () => {
  async function raceAgainst(
    seed: Seed,
    attempt: () => Promise<{ readonly kind: string }>,
  ) {
    const suspension = await holdSuspension(seed.ownerUserId);
    let settled = false;
    const outcome = attempt().then((result) => {
      settled = true;
      return result;
    });
    await pause(300);
    expect(settled).toBe(false);
    suspension.commit();
    await suspension.finished;
    return outcome;
  }

  it("makes a draft save wait, then refuses it", async () => {
    const seed = await seeded();
    const outcome = await raceAgainst(seed, () =>
      repository.save({
        changedAt: now,
        collectionId: seed.collectionId,
        draft: draft({ name: "Late" }),
        expectedRevision: 1,
        ownerUserId: seed.ownerUserId,
      }),
    );
    expect(outcome).toEqual({ kind: "not-eligible" });
  });

  it("makes an item add wait, then refuses it", async () => {
    const seed = await seeded();
    const image = await seedAsset(seed.ownerUserId, "collection-item-artwork");
    const outcome = await raceAgainst(seed, () =>
      repository.addItem({
        ...mutation(seed.ownerUserId),
        collectionId: seed.collectionId,
        item: itemFor(image),
        itemId: newId(),
        itemLimit: 100,
      }),
    );
    expect(outcome).toEqual({ kind: "not-eligible" });
  });

  it("makes a draft creation wait, then refuses it", async () => {
    const owner = await seedUser();
    const outcome = await raceAgainst(
      { collectionId: newId(), ownerUserId: owner },
      () =>
        repository.create({
          ...mutation(owner),
          collectionId: newId(),
          draft: draft(),
        }),
    );
    expect(outcome).toEqual({ kind: "not-eligible" });
  });
});

// Two requests with one idempotency key must not both insert: the second waits for the first.
describe("creation by idempotency key", () => {
  it("waits while another request holds the creator's key, then replays", async () => {
    const owner = await seedUser();
    const context = mutation(owner);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let taken: () => void = () => undefined;
    const lockTaken = new Promise<void>((resolve) => {
      taken = resolve;
    });
    const holder = database.transaction(async (transaction) => {
      await lockCreation(transaction, owner, context.idempotencyKey);
      taken();
      await held;
    });
    await lockTaken;
    let settled = false;
    const attempt = repository
      .create({ ...context, collectionId: newId(), draft: draft() })
      .then((result) => {
        settled = true;
        return result;
      });
    await pause(300);
    expect(settled).toBe(false);
    release();
    await holder;
    expect((await attempt).kind).toBe("created");
  });
});
