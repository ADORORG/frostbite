ALTER SCHEMA "ador" RENAME TO "frostbite";--> statement-breakpoint
-- Hand-written: a function body is text, so renaming the schema did not reach the table this one reads, and its trigger would fail on the
-- first review event. The trigger itself is attached to the function, not to its name, and needs nothing.
CREATE OR REPLACE FUNCTION "frostbite"."collection_review_events_actor_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT owner_user_id INTO owner FROM "frostbite"."collection_submissions" WHERE id = NEW.submission_id;
  IF NEW.action = 'submit' AND NEW.actor_user_id IS DISTINCT FROM owner THEN
    RAISE EXCEPTION 'only the creator submits their own collection' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.action <> 'submit' AND NEW.actor_user_id IS NOT DISTINCT FROM owner THEN
    RAISE EXCEPTION 'nobody can decide on their own collection' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
