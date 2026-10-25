CREATE TABLE "ador"."platform_setup_links" (
	"id" uuid PRIMARY KEY,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "platform_setup_links_token_hash_valid" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "platform_setup_links_expiry_after_creation" CHECK ("expires_at" > "created_at"),
	CONSTRAINT "platform_setup_links_consumption_consistent" CHECK (("consumed_at" is null) = ("consumed_by_user_id" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_setup_links_token_hash_unique" ON "ador"."platform_setup_links" ("token_hash");--> statement-breakpoint
ALTER TABLE "ador"."platform_setup_links" ADD CONSTRAINT "platform_setup_links_consumed_by_user_id_auth_users_id_fkey" FOREIGN KEY ("consumed_by_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;