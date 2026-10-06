CREATE TABLE "ador"."wallet_qualification_challenges" (
	"id" uuid PRIMARY KEY,
	"address" text NOT NULL,
	"origin" text NOT NULL,
	"message_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "wallet_qualification_hash_sha256" CHECK ("message_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "wallet_qualification_attempts_nonnegative" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX "wallet_qualification_expiry_idx" ON "ador"."wallet_qualification_challenges" ("expires_at");