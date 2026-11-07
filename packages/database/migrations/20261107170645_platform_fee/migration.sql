CREATE TABLE "frostbite"."game_mint_totals" (
	"completed" bigint NOT NULL,
	"fees_sats" bigint NOT NULL,
	"game_id" text PRIMARY KEY,
	CONSTRAINT "game_mint_totals_not_negative" CHECK ("completed" >= 0 and "fees_sats" >= 0)
);
--> statement-breakpoint
CREATE TABLE "frostbite"."platform_fee_settings" (
	"chain" text NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fee_sats" bigint NOT NULL,
	"id" uuid PRIMARY KEY,
	"treasury_address" text NOT NULL,
	CONSTRAINT "platform_fee_settings_fee_not_negative" CHECK ("fee_sats" >= 0)
);
--> statement-breakpoint
ALTER TABLE "frostbite"."game_milestone_claims" ADD COLUMN "platform_fee_sats" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "game_milestone_claims_game_state_idx" ON "frostbite"."game_milestone_claims" ("game_id","state");--> statement-breakpoint
CREATE INDEX "game_milestone_claims_game_recent_idx" ON "frostbite"."game_milestone_claims" ("game_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "state" = 'complete';--> statement-breakpoint
CREATE INDEX "platform_fee_settings_chain_newest_idx" ON "frostbite"."platform_fee_settings" ("chain","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "frostbite"."platform_fee_settings" ADD CONSTRAINT "platform_fee_settings_changed_by_auth_users_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "frostbite"."auth_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "frostbite"."game_milestone_claims" ADD CONSTRAINT "game_milestone_claims_platform_fee_not_negative" CHECK ("platform_fee_sats" >= 0);--> statement-breakpoint
-- Hand-written (the schema cannot say it): `game_mint_totals` follows `game_milestone_claims` through triggers, so the totals are right
-- whatever writes a claim and reading them costs a row per game however many mints there are. A claim becoming complete adds one mint and
-- its fee; a claim leaving complete takes them away. Deleting a claim takes nothing away (see the table's comment in the schema).
CREATE FUNCTION "frostbite"."game_mint_totals_apply"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.state = 'complete' THEN
    UPDATE "frostbite"."game_mint_totals"
      SET completed = completed - 1, fees_sats = fees_sats - OLD.platform_fee_sats
      WHERE game_id = OLD.game_id;
  END IF;
  IF NEW.state = 'complete' THEN
    INSERT INTO "frostbite"."game_mint_totals" (game_id, completed, fees_sats)
      VALUES (NEW.game_id, 1, NEW.platform_fee_sats)
      ON CONFLICT (game_id) DO UPDATE
      SET completed = "frostbite"."game_mint_totals".completed + 1,
          fees_sats = "frostbite"."game_mint_totals".fees_sats + EXCLUDED.fees_sats;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "game_milestone_claims_mint_totals_insert" AFTER INSERT ON "frostbite"."game_milestone_claims"
  FOR EACH ROW WHEN (NEW.state = 'complete') EXECUTE FUNCTION "frostbite"."game_mint_totals_apply"();
--> statement-breakpoint
-- Only an update that touches what the totals are made of runs it: a claim moving between the states before complete does not.
CREATE TRIGGER "game_milestone_claims_mint_totals_update" AFTER UPDATE ON "frostbite"."game_milestone_claims"
  FOR EACH ROW WHEN ((OLD.state = 'complete' OR NEW.state = 'complete') AND (OLD.state IS DISTINCT FROM NEW.state OR OLD.game_id IS DISTINCT FROM NEW.game_id OR OLD.platform_fee_sats IS DISTINCT FROM NEW.platform_fee_sats))
  EXECUTE FUNCTION "frostbite"."game_mint_totals_apply"();
--> statement-breakpoint
-- The mints completed before this migration, each with no fee (there was none).
INSERT INTO "frostbite"."game_mint_totals" (game_id, completed, fees_sats)
  SELECT game_id, count(*), coalesce(sum(platform_fee_sats), 0) FROM "frostbite"."game_milestone_claims"
  WHERE state = 'complete' GROUP BY game_id;
