CREATE TABLE "ador"."rate_limit_windows" (
	"bucket" text,
	"subject_hash" text,
	"window_start" timestamp with time zone,
	"hits" integer NOT NULL,
	CONSTRAINT "rate_limit_windows_pkey" PRIMARY KEY("bucket","subject_hash","window_start"),
	CONSTRAINT "rate_limit_hits_positive" CHECK ("hits" > 0),
	CONSTRAINT "rate_limit_subject_hash_sha256" CHECK ("subject_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "rate_limit_bucket_bounded" CHECK (length("bucket") between 1 and 128)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_windows_start_idx" ON "ador"."rate_limit_windows" ("window_start");