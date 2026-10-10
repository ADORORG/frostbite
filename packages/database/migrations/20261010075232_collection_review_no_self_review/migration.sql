-- Hand-written: drizzle-kit does not model triggers. Only a creator submits their own collection, and
-- nobody ever decides on their own: the review record itself refuses an event by the wrong person,
-- whatever the application did.
CREATE FUNCTION "ador"."collection_review_events_actor_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT owner_user_id INTO owner FROM "ador"."collection_submissions" WHERE id = NEW.submission_id;
  IF NEW.action = 'submit' AND NEW.actor_user_id IS DISTINCT FROM owner THEN
    RAISE EXCEPTION 'only the creator submits their own collection' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.action <> 'submit' AND NEW.actor_user_id IS NOT DISTINCT FROM owner THEN
    RAISE EXCEPTION 'nobody can decide on their own collection' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "collection_review_events_actor_guard" BEFORE INSERT ON "ador"."collection_review_events"
  FOR EACH ROW EXECUTE FUNCTION "ador"."collection_review_events_actor_guard"();
