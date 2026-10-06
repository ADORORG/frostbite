import {
  derivativeKinds,
  type DerivativeKind,
  type UploadContentType,
} from "@ador/shared/uploads";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { platformSchema } from "./platform.ts";
import { assets, uploadContentType } from "./uploads.ts";

export const derivativeKind = platformSchema.enum(
  "derivative_kind",
  derivativeKinds,
);

// Private, write-once derivative objects. Keys embed the spec version and content hash, so a
// changed spec never overwrites earlier output and a retry rewrites identical bytes.
export const assetDerivatives = platformSchema.table(
  "asset_derivatives",
  {
    id: uuid("id").primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    kind: derivativeKind("kind").$type<DerivativeKind>().notNull(),
    specVersion: text("spec_version").notNull(),
    storageProviderId: text("storage_provider_id").notNull(),
    objectKey: text("object_key").notNull().unique(),
    contentType: uploadContentType("content_type")
      .$type<UploadContentType>()
      .notNull(),
    byteLength: bigint("byte_length", { mode: "number" }).notNull(),
    widthPixels: integer("width_pixels").notNull(),
    heightPixels: integer("height_pixels").notNull(),
    contentSha256: text("content_sha256").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("asset_derivatives_asset_kind_spec_unique").on(
      table.assetId,
      table.kind,
      table.specVersion,
    ),
    check("asset_derivatives_bytes_positive", sql`${table.byteLength} > 0`),
    check(
      "asset_derivatives_dimensions_positive",
      sql`${table.widthPixels} > 0 AND ${table.heightPixels} > 0`,
    ),
    check(
      "asset_derivatives_hash_sha256",
      sql`${table.contentSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "asset_derivatives_spec_nonempty",
      sql`length(btrim(${table.specVersion})) > 0`,
    ),
    check(
      "asset_derivatives_provider_nonempty",
      sql`length(btrim(${table.storageProviderId})) > 0`,
    ),
  ],
);

export type AssetDerivative = typeof assetDerivatives.$inferSelect;
