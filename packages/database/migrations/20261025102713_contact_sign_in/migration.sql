CREATE TABLE "ador"."contact_codes" (
	"id" uuid PRIMARY KEY,
	"kind" text NOT NULL,
	"destination" text NOT NULL,
	"code_hash" text NOT NULL,
	"salt" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "contact_codes_attempts_nonnegative" CHECK ("attempts" >= 0),
	CONSTRAINT "contact_codes_hash_sha256" CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "contact_codes_expiry_after_issue" CHECK ("expires_at" > "issued_at"),
	CONSTRAINT "contact_codes_salt_nonempty" CHECK ("salt" <> '')
);
--> statement-breakpoint
CREATE TABLE "ador"."contact_identities" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_identities_kind_valid" CHECK ("kind" ~ '^[a-z][a-z0-9-]*$'),
	CONSTRAINT "contact_identities_value_nonempty" CHECK (btrim("value") <> '')
);
--> statement-breakpoint
CREATE INDEX "contact_codes_destination_issued_idx" ON "ador"."contact_codes" ("kind","destination","issued_at");--> statement-breakpoint
CREATE INDEX "contact_codes_expiry_idx" ON "ador"."contact_codes" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_identities_kind_value_unique" ON "ador"."contact_identities" ("kind","value");--> statement-breakpoint
CREATE INDEX "contact_identities_user_id_idx" ON "ador"."contact_identities" ("user_id");--> statement-breakpoint
ALTER TABLE "ador"."contact_identities" ADD CONSTRAINT "contact_identities_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ador"."auth_users"("id") ON DELETE CASCADE;