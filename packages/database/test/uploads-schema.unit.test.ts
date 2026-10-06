import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assetDerivatives,
  assets,
  authUsers,
  type Asset,
  type UploadIntent,
  uploadIntents,
} from "../src/index.ts";

describe("upload-intent schema", () => {
  it("owns authorization, lifecycle, idempotency, and quota lookup evidence", () => {
    const config = getTableConfig(uploadIntents);
    expect(
      config.foreignKeys.map((key) =>
        getTableName(key.reference().foreignTable),
      ),
    ).toEqual([getTableName(authUsers)]);
    expect(config.indexes.map(({ config: index }) => index.name)).toEqual(
      expect.arrayContaining([
        "upload_intents_user_idempotency_unique",
        "upload_intents_active_user_idx",
      ]),
    );
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "upload_intents_byte_length_positive",
        "upload_intents_storage_provider_nonempty",
        "upload_intents_fingerprint_sha256",
        "upload_intents_cleanup_after_expiry",
        "upload_intents_retention_after_cleanup",
      ]),
    );
  });

  it("infers persistence fields from the Drizzle table", () => {
    expectTypeOf<UploadIntent["byteLength"]>().toEqualTypeOf<number>();
    expectTypeOf<UploadIntent["state"]>().toEqualTypeOf<
      "reserved" | "completed" | "cancelled" | "failed"
    >();
  });
});

describe("asset schema", () => {
  it("owns its intent, user, storage observation, and processing state", () => {
    const config = getTableConfig(assets);
    expect(
      config.foreignKeys.map((key) =>
        getTableName(key.reference().foreignTable),
      ),
    ).toEqual([getTableName(uploadIntents), getTableName(authUsers)]);
    expect(config.indexes.map(({ config: index }) => index.name)).toEqual(
      expect.arrayContaining([
        "assets_upload_intent_unique",
        "assets_user_created_idx",
      ]),
    );
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "assets_observed_bytes_positive",
        "assets_storage_provider_nonempty",
        "assets_object_key_nonempty",
        "assets_content_type_nonempty",
        "assets_entity_tag_nonempty",
        "assets_validation_coherent",
      ]),
    );
  });

  it("infers asset state and measured bytes from Drizzle", () => {
    expectTypeOf<Asset["processingState"]>().toEqualTypeOf<
      | "pending-validation"
      | "validated"
      | "rejected"
      | "processed"
      | "unprocessable"
    >();
    expectTypeOf<Asset["observedByteLength"]>().toEqualTypeOf<number>();
  });

  it("keeps derivatives private, write-once per spec version, and owned by one asset", () => {
    const config = getTableConfig(assetDerivatives);
    expect(
      config.foreignKeys.map((key) =>
        getTableName(key.reference().foreignTable),
      ),
    ).toEqual([getTableName(assets)]);
    expect(config.indexes.map(({ config: index }) => index.name)).toContain(
      "asset_derivatives_asset_kind_spec_unique",
    );
    expect(config.checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "asset_derivatives_bytes_positive",
        "asset_derivatives_dimensions_positive",
        "asset_derivatives_hash_sha256",
        "asset_derivatives_spec_nonempty",
        "asset_derivatives_provider_nonempty",
      ]),
    );
  });
});
