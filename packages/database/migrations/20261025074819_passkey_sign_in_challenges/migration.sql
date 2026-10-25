CREATE TABLE "ador"."passkey_sign_in_challenges" (
	"id" uuid PRIMARY KEY,
	"challenge_hash" text NOT NULL,
	"origin" text NOT NULL,
	"relying_party_id" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "passkey_sign_in_challenges_hash_sha256" CHECK ("challenge_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "passkey_sign_in_challenges_expiry_after_issue" CHECK ("expires_at" > "issued_at")
);
--> statement-breakpoint
CREATE INDEX "passkey_sign_in_challenges_expiry_idx" ON "ador"."passkey_sign_in_challenges" ("expires_at");