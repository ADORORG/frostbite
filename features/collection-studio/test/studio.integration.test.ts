import {
  collectionDetailSchema,
  collectionItemChangeSchema,
  collectionItemRemovedSchema,
  collectionListResponseSchema,
  collectionRoutes,
} from "@frostbite/shared/collections";
import { seedCreatorUser } from "@frostbite/test-kit/creator-database";
import { beforeAll, describe, expect, it } from "vitest";

import {
  call,
  creatorWithImages,
  database,
  draft,
  errorOf,
  item,
  key,
  migrate,
  signedUrl,
} from "./support/studio-harness.ts";

beforeAll(migrate);

describe("collection studio operations over the real database", () => {
  it("lets an approved creator build, preview, edit, and list a draft", async () => {
    const { cover, coverKey, image, userId } = await creatorWithImages();
    const created = await call(collectionRoutes.create, {
      actor: userId,
      body: draft({ coverAssetId: cover }),
      key: key(),
    });
    expect(created.status).toBe(200);
    const detail = collectionDetailSchema.parse(created.body);
    const preview = detail.previews.find(({ id }) => id === cover);
    expect(preview?.derivativeAccess).toBe("available");
    expect(preview?.derivatives[0]?.url).toBe(signedUrl(coverKey));
    const collectionId = detail.collection.id;

    const added = await call(collectionRoutes.addItem, {
      actor: userId,
      body: { collectionId, item: item(image) },
      key: key(),
    });
    const change = collectionItemChangeSchema.parse(added.body);
    expect([added.status, change.item.position, change.revision]).toEqual([
      200, 1, 2,
    ]);

    const saved = await call(collectionRoutes.save, {
      actor: userId,
      body: {
        collectionId,
        draft: draft({ coverAssetId: cover, name: "Renamed" }),
        expectedRevision: change.revision,
      },
    });
    expect(collectionDetailSchema.parse(saved.body).collection).toMatchObject({
      name: "Renamed",
      revision: 3,
    });

    const stale = await call(collectionRoutes.save, {
      actor: userId,
      body: { collectionId, draft: draft(), expectedRevision: change.revision },
    });
    expect([stale.status, errorOf(stale.body)]).toEqual([409, "conflict"]);

    const read = await call(collectionRoutes.read, {
      actor: userId,
      body: { collectionId },
    });
    expect(collectionDetailSchema.parse(read.body).items).toHaveLength(1);

    const removed = await call(collectionRoutes.removeItem, {
      actor: userId,
      body: { collectionId, itemId: change.item.id },
    });
    expect(collectionItemRemovedSchema.parse(removed.body)).toEqual({
      removed: true,
      revision: 4,
    });

    const listed = await call(collectionRoutes.list, { actor: userId });
    expect(
      collectionListResponseSchema
        .parse(listed.body)
        .collections.map(({ id, itemCount }) => [id, itemCount]),
    ).toEqual([[collectionId, 0]]);
  });

  it("answers an item update with the item and the new revision", async () => {
    const { image, userId } = await creatorWithImages();
    const detail = collectionDetailSchema.parse(
      (
        await call(collectionRoutes.create, {
          actor: userId,
          body: draft(),
          key: key(),
        })
      ).body,
    );
    const collectionId = detail.collection.id;
    const added = collectionItemChangeSchema.parse(
      (
        await call(collectionRoutes.addItem, {
          actor: userId,
          body: { collectionId, item: item(image) },
          key: key(),
        })
      ).body,
    );
    const updated = await call(collectionRoutes.updateItem, {
      actor: userId,
      body: {
        collectionId,
        item: { ...item(image), name: "Renamed" },
        itemId: added.item.id,
      },
    });
    expect(collectionItemChangeSchema.parse(updated.body)).toMatchObject({
      item: { name: "Renamed", position: 1 },
      revision: 3,
    });
  });

  it("requires a session, an approved creator, a valid body, and the idempotency header", async () => {
    const { userId } = await creatorWithImages();
    const anonymous = await call(collectionRoutes.list, { actor: null });
    expect([anonymous.status, errorOf(anonymous.body)]).toEqual([
      401,
      "unauthorized",
    ]);

    const unapproved = await seedCreatorUser(database, null);
    const refused = await call(collectionRoutes.create, {
      actor: unapproved,
      body: draft(),
      key: key(),
    });
    expect([refused.status, errorOf(refused.body)]).toEqual([403, "forbidden"]);

    const invalid = await call(collectionRoutes.create, {
      actor: userId,
      body: draft({ plannedSupply: 0 }),
      key: key(),
    });
    expect([invalid.status, errorOf(invalid.body)]).toEqual([
      400,
      "invalid_request",
    ]);

    const noKey = await call(collectionRoutes.create, {
      actor: userId,
      body: draft(),
    });
    expect([noKey.status, errorOf(noKey.body)]).toEqual([
      400,
      "idempotency_key_required",
    ]);
  });

  it("refuses a chain that is not enabled and an image that is not the creator's", async () => {
    const { userId } = await creatorWithImages();
    const other = await creatorWithImages();
    const unavailable = await call(collectionRoutes.create, {
      actor: userId,
      body: draft({ targetChain: "eip155:1" }),
      key: key(),
    });
    expect([unavailable.status, errorOf(unavailable.body)]).toEqual([
      400,
      "invalid_request",
    ]);
    const borrowed = await call(collectionRoutes.create, {
      actor: userId,
      body: draft({ coverAssetId: other.cover }),
      key: key(),
    });
    expect([borrowed.status, errorOf(borrowed.body)]).toEqual([
      400,
      "invalid_request",
    ]);
  });

  it("never discloses another creator's draft", async () => {
    const owner = await creatorWithImages();
    const intruder = await creatorWithImages();
    const detail = collectionDetailSchema.parse(
      (
        await call(collectionRoutes.create, {
          actor: owner.userId,
          body: draft(),
          key: key(),
        })
      ).body,
    );
    const read = await call(collectionRoutes.read, {
      actor: intruder.userId,
      body: { collectionId: detail.collection.id },
    });
    expect([read.status, errorOf(read.body)]).toEqual([404, "not_found"]);
  });
});
