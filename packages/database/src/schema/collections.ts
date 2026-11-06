import {
  collectionLimits,
  type CollectionItem,
} from "@frostbite/shared/collections";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./auth.ts";
import { platformSchema } from "./platform.ts";
import { assets } from "./uploads.ts";

function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

// The mutable draft of a collection. `revision` is bumped by every change to the draft or its items,
// and a save must name the revision it was based on. Frozen, reviewable copies are taken at
// submission (W4-03); nothing here is ever shown publicly.
export const collections = platformSchema.table(
  "collections",
  {
    id: uuid("id").primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    // A CAIP-2 chain reference (ADR-017). A draft only targets a chain; the adapter family and version
    // are recorded when a deployment binds the collection to one.
    chainId: text("chain_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    provenance: text("provenance").notNull(),
    plannedSupply: integer("planned_supply").notNull(),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id, {
      onDelete: "restrict",
    }),
    bannerAssetId: uuid("banner_asset_id").references(() => assets.id, {
      onDelete: "restrict",
    }),
    revision: integer("revision").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("collections_owner_idempotency_unique").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
    index("collections_owner_updated_idx").on(
      table.ownerUserId,
      table.updatedAt,
    ),
    check("collections_revision_positive", sql`${table.revision} > 0`),
    check(
      "collections_name_valid",
      sql`length(${table.name}) between 1 and ${sql.raw(String(collectionLimits.name))} and ${table.name} = btrim(${table.name})`,
    ),
    check(
      "collections_text_bounded",
      sql`length(${table.description}) <= ${sql.raw(String(collectionLimits.description))} and length(${table.provenance}) <= ${sql.raw(String(collectionLimits.provenance))}`,
    ),
    check(
      "collections_planned_supply_bounded",
      sql`${table.plannedSupply} between 1 and ${sql.raw(String(collectionLimits.plannedSupply))}`,
    ),
    check(
      "collections_chain_id_caip2",
      sql`${table.chainId} ~ '^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$'`,
    ),
    check(
      "collections_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const collectionItems = platformSchema.table(
  "collection_items",
  {
    id: uuid("id").primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "restrict" }),
    // Display order. Positions only grow, so removing an item leaves a gap rather than renumbering.
    position: integer("position").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    imageAssetId: uuid("image_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    attributes: jsonb("attributes")
      .$type<CollectionItem["attributes"]>()
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("collection_items_collection_position_unique").on(
      table.collectionId,
      table.position,
    ),
    uniqueIndex("collection_items_collection_idempotency_unique").on(
      table.collectionId,
      table.idempotencyKey,
    ),
    check("collection_items_position_positive", sql`${table.position} > 0`),
    check(
      "collection_items_name_valid",
      sql`length(${table.name}) between 1 and ${sql.raw(String(collectionLimits.itemName))} and ${table.name} = btrim(${table.name})`,
    ),
    check(
      "collection_items_description_bounded",
      sql`length(${table.description}) <= ${sql.raw(String(collectionLimits.itemDescription))}`,
    ),
    check(
      "collection_items_attributes_bounded",
      sql`jsonb_typeof(${table.attributes}) = 'array' and jsonb_array_length(${table.attributes}) <= ${sql.raw(String(collectionLimits.attributesPerItem))}`,
    ),
    check(
      "collection_items_fingerprint_sha256",
      sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export type Collection = typeof collections.$inferSelect;
export type CollectionItemRow = typeof collectionItems.$inferSelect;
