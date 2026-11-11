CREATE TABLE "frostbite"."game_score_bests" (
	"game_id" text,
	"window_kind" text,
	"window_start" date,
	"user_id" uuid,
	"score" bigint NOT NULL,
	"achieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "game_score_bests_pkey" PRIMARY KEY("game_id","window_kind","window_start","user_id"),
	CONSTRAINT "game_score_bests_kind_known" CHECK ("window_kind" in ('all', 'month', 'week')),
	CONSTRAINT "game_score_bests_not_negative" CHECK ("score" >= 0)
);
--> statement-breakpoint
CREATE INDEX "game_score_bests_board_idx" ON "frostbite"."game_score_bests" ("game_id","window_kind","window_start","score" DESC NULLS LAST,"achieved_at");--> statement-breakpoint
ALTER TABLE "frostbite"."game_score_bests" ADD CONSTRAINT "game_score_bests_user_id_auth_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "frostbite"."auth_users"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE FUNCTION "frostbite"."game_score_bests_offer"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "frostbite"."game_score_bests" ("game_id", "window_kind", "window_start", "user_id", "score", "achieved_at")
    SELECT NEW.game_id, w.kind, w.start, NEW.user_id, NEW.score, NEW.submitted_at
    FROM (VALUES
      ('all', DATE '1970-01-01'),
      ('month', date_trunc('month', NEW.submitted_at AT TIME ZONE 'UTC')::date),
      ('week', date_trunc('week', NEW.submitted_at AT TIME ZONE 'UTC')::date)
    ) AS w(kind, start)
    ON CONFLICT ("game_id", "window_kind", "window_start", "user_id") DO UPDATE
      SET "score" = EXCLUDED."score", "achieved_at" = EXCLUDED."achieved_at"
      WHERE EXCLUDED."score" > "frostbite"."game_score_bests"."score";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "game_score_bests_insert"
  AFTER INSERT ON "frostbite"."game_runs"
  FOR EACH ROW WHEN (NEW.state = 'submitted' AND NEW.verdict = 'verified' AND NEW.score IS NOT NULL)
  EXECUTE FUNCTION "frostbite"."game_score_bests_offer"();
--> statement-breakpoint
CREATE TRIGGER "game_score_bests_update"
  AFTER UPDATE ON "frostbite"."game_runs"
  FOR EACH ROW WHEN (
    NEW.state = 'submitted' AND NEW.verdict = 'verified' AND NEW.score IS NOT NULL
    AND (OLD.state IS DISTINCT FROM NEW.state
      OR OLD.verdict IS DISTINCT FROM NEW.verdict
      OR OLD.score IS DISTINCT FROM NEW.score)
  )
  EXECUTE FUNCTION "frostbite"."game_score_bests_offer"();
--> statement-breakpoint
INSERT INTO "frostbite"."game_score_bests" ("game_id", "window_kind", "window_start", "user_id", "score", "achieved_at")
  SELECT DISTINCT ON (r.game_id, w.kind, w.start, r.user_id)
    r.game_id, w.kind, w.start, r.user_id, r.score, r.submitted_at
  FROM "frostbite"."game_runs" r
  CROSS JOIN LATERAL (VALUES
    ('all', DATE '1970-01-01'),
    ('month', date_trunc('month', r.submitted_at AT TIME ZONE 'UTC')::date),
    ('week', date_trunc('week', r.submitted_at AT TIME ZONE 'UTC')::date)
  ) AS w(kind, start)
  WHERE r.state = 'submitted' AND r.verdict = 'verified' AND r.score IS NOT NULL
  ORDER BY r.game_id, w.kind, w.start, r.user_id, r.score DESC, r.submitted_at ASC
  ON CONFLICT DO NOTHING;
