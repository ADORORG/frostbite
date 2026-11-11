CREATE TABLE "frostbite"."game_shares" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"game_id" text,
	"milestone_id" text,
	"score" bigint,
	"verification" text,
	"created_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "game_shares_shape" CHECK (("kind" = 'milestones' and "game_id" is null and "milestone_id" is null and "score" is null and "verification" is null)
        or ("kind" = 'milestone' and "game_id" is not null and "milestone_id" is not null and "score" is null and "verification" in ('replay-verified', 'self-reported'))
        or ("kind" = 'score' and "game_id" is not null and "milestone_id" is null and "score" >= 0 and "verification" = 'self-reported')),
	CONSTRAINT "game_shares_revoked_after_created" CHECK ("revoked_at" is null or "revoked_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "game_shares_live_milestones_idx" ON "frostbite"."game_shares" ("user_id") WHERE "kind" = 'milestones' and "revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_shares_live_milestone_idx" ON "frostbite"."game_shares" ("user_id","game_id","milestone_id") WHERE "kind" = 'milestone' and "revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "game_shares_live_score_idx" ON "frostbite"."game_shares" ("user_id","game_id","score") WHERE "kind" = 'score' and "revoked_at" is null;--> statement-breakpoint
ALTER TABLE "frostbite"."game_shares" ADD CONSTRAINT "game_shares_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "frostbite"."auth_users"("id") ON DELETE CASCADE;