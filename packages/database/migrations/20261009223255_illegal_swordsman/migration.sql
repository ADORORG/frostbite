CREATE TABLE "ador"."collection_items" (
	"id" uuid PRIMARY KEY,
	"collection_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"image_asset_id" uuid NOT NULL,
	"attributes" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_position_positive" CHECK ("position" > 0),
	CONSTRAINT "collection_items_name_valid" CHECK (length("name") between 1 and 120 and "name" = btrim("name")),
	CONSTRAINT "collection_items_description_bounded" CHECK (length("description") <= 1000),
	CONSTRAINT "collection_items_attributes_bounded" CHECK (jsonb_typeof("attributes") = 'array' and jsonb_array_length("attributes") <= 32),
	CONSTRAINT "collection_items_fingerprint_sha256" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ador"."collections" (
	"id" uuid PRIMARY KEY,
	"owner_user_id" uuid NOT NULL,
	"chain_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"provenance" text NOT NULL,
	"planned_supply" integer NOT NULL,
	"cover_asset_id" uuid,
	"banner_asset_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_revision_positive" CHECK ("revision" > 0),
	CONSTRAINT "collections_name_valid" CHECK (length("name") between 1 and 120 and "name" = btrim("name")),
	CONSTRAINT "collections_text_bounded" CHECK (length("description") <= 4000 and length("provenance") <= 2000),
	CONSTRAINT "collections_planned_supply_bounded" CHECK ("planned_supply" between 1 and 1000000),
	CONSTRAINT "collections_chain_id_caip2" CHECK ("chain_id" ~ '^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$'),
	CONSTRAINT "collections_fingerprint_sha256" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_collection_position_unique" ON "ador"."collection_items" ("collection_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_collection_idempotency_unique" ON "ador"."collection_items" ("collection_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_owner_idempotency_unique" ON "ador"."collections" ("owner_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "collections_owner_updated_idx" ON "ador"."collections" ("owner_user_id","updated_at");--> statement-breakpoint
ALTER TABLE "ador"."collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "ador"."collections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collection_items" ADD CONSTRAINT "collection_items_image_asset_id_assets_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "ador"."assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collections" ADD CONSTRAINT "collections_owner_user_id_auth_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collections" ADD CONSTRAINT "collections_cover_asset_id_assets_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "ador"."assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collections" ADD CONSTRAINT "collections_banner_asset_id_assets_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "ador"."assets"("id") ON DELETE RESTRICT;