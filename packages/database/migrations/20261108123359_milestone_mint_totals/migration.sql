CREATE TABLE "frostbite"."game_milestone_mint_totals" (
	"completed" bigint NOT NULL,
	"game_id" text,
	"milestone_id" text,
	CONSTRAINT "game_milestone_mint_totals_pkey" PRIMARY KEY("game_id","milestone_id"),
	CONSTRAINT "game_milestone_mint_totals_not_negative" CHECK ("completed" >= 0)
);

--> statement-breakpoint
CREATE FUNCTION "frostbite"."game_milestone_mint_totals_apply"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.state = 'complete' THEN
    UPDATE "frostbite"."game_milestone_mint_totals"
      SET "completed" = "completed" - 1
      WHERE "game_id" = OLD.game_id AND "milestone_id" = OLD.milestone_id;
  END IF;
  IF NEW.state = 'complete' THEN
    INSERT INTO "frostbite"."game_milestone_mint_totals" ("game_id", "milestone_id", "completed")
      VALUES (NEW.game_id, NEW.milestone_id, 1)
      ON CONFLICT ("game_id", "milestone_id") DO UPDATE
        SET "completed" = "frostbite"."game_milestone_mint_totals"."completed" + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "game_milestone_mint_totals_insert"
  AFTER INSERT ON "frostbite"."game_milestone_claims"
  FOR EACH ROW WHEN (NEW.state = 'complete')
  EXECUTE FUNCTION "frostbite"."game_milestone_mint_totals_apply"();
--> statement-breakpoint
CREATE TRIGGER "game_milestone_mint_totals_update"
  AFTER UPDATE ON "frostbite"."game_milestone_claims"
  FOR EACH ROW WHEN (
    (OLD.state = 'complete' OR NEW.state = 'complete')
    AND (OLD.state IS DISTINCT FROM NEW.state
      OR OLD.game_id IS DISTINCT FROM NEW.game_id
      OR OLD.milestone_id IS DISTINCT FROM NEW.milestone_id)
  )
  EXECUTE FUNCTION "frostbite"."game_milestone_mint_totals_apply"();
--> statement-breakpoint
INSERT INTO "frostbite"."game_milestone_mint_totals" ("game_id", "milestone_id", "completed")
  SELECT "game_id", "milestone_id", count(*) FROM "frostbite"."game_milestone_claims"
  WHERE "state" = 'complete' GROUP BY "game_id", "milestone_id";
