CREATE TYPE "ador"."collection_submission_action" AS ENUM('submit', 'start-review', 'approve', 'request-changes', 'reject', 'suspend', 'reinstate', 'revoke');--> statement-breakpoint
CREATE TYPE "ador"."collection_submission_state" AS ENUM('submitted', 'under-review', 'approved', 'changes-requested', 'rejected', 'suspended', 'revoked');--> statement-breakpoint
CREATE TABLE "ador"."collection_review_events" (
	"id" uuid PRIMARY KEY,
	"submission_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" "ador"."collection_submission_action" NOT NULL,
	"previous_state" "ador"."collection_submission_state",
	"next_state" "ador"."collection_submission_state" NOT NULL,
	"reason_code" text NOT NULL,
	"creator_feedback" text DEFAULT '' NOT NULL,
	"private_notes" text DEFAULT '' NOT NULL,
	"policy_version" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_review_events_reason_code_valid" CHECK ("reason_code" ~ '^[a-z][a-z0-9-]{2,63}$'),
	CONSTRAINT "collection_review_events_policy_version_nonempty" CHECK (length("policy_version") > 0 and "policy_version" = btrim("policy_version")),
	CONSTRAINT "collection_review_events_fingerprint_sha256" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "collection_review_events_previous_state_coherent" CHECK (("action" = 'submit') = ("previous_state" is null))
);
--> statement-breakpoint
CREATE TABLE "ador"."collection_submissions" (
	"id" uuid PRIMARY KEY,
	"collection_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"collection_revision" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"state" "ador"."collection_submission_state" DEFAULT 'submitted'::"ador"."collection_submission_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_submissions_sequence_positive" CHECK ("sequence" > 0),
	CONSTRAINT "collection_submissions_revision_positive" CHECK ("collection_revision" > 0),
	CONSTRAINT "collection_submissions_schema_version_supported" CHECK ("schema_version" = 1),
	CONSTRAINT "collection_submissions_hash_sha256" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "collection_review_events_idempotency_unique" ON "ador"."collection_review_events" ("idempotency_key");--> statement-breakpoint
CREATE INDEX "collection_review_events_submission_created_idx" ON "ador"."collection_review_events" ("submission_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_submissions_collection_sequence_unique" ON "ador"."collection_submissions" ("collection_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_submissions_one_live_per_collection" ON "ador"."collection_submissions" ("collection_id") WHERE "state" in ('submitted', 'under-review', 'approved', 'suspended');--> statement-breakpoint
CREATE INDEX "collection_submissions_state_updated_idx" ON "ador"."collection_submissions" ("state","updated_at");--> statement-breakpoint
ALTER TABLE "ador"."collection_review_events" ADD CONSTRAINT "collection_review_events_45kKpDSi5ty7_fkey" FOREIGN KEY ("submission_id") REFERENCES "ador"."collection_submissions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collection_review_events" ADD CONSTRAINT "collection_review_events_actor_user_id_auth_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collection_submissions" ADD CONSTRAINT "collection_submissions_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "ador"."collections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ador"."collection_submissions" ADD CONSTRAINT "collection_submissions_owner_user_id_auth_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "ador"."auth_users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
-- Hand-written: drizzle-kit does not model triggers. A submission is a frozen copy; only its review
-- state (and the time of the change) may ever change, and nothing is ever deleted.
CREATE FUNCTION "ador"."collection_submissions_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'collection submissions cannot be deleted' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (NEW.id, NEW.collection_id, NEW.owner_user_id, NEW.sequence, NEW.collection_revision,
      NEW.schema_version, NEW.snapshot, NEW.payload_hash, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.collection_id, OLD.owner_user_id, OLD.sequence, OLD.collection_revision,
      OLD.schema_version, OLD.snapshot, OLD.payload_hash, OLD.created_at) THEN
    RAISE EXCEPTION 'a collection submission is immutable; only its review state may change' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "collection_submissions_guard" BEFORE UPDATE OR DELETE ON "ador"."collection_submissions"
  FOR EACH ROW EXECUTE FUNCTION "ador"."collection_submissions_guard"();--> statement-breakpoint
CREATE FUNCTION "ador"."collection_review_events_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'collection review events are append-only' USING ERRCODE = 'integrity_constraint_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "collection_review_events_guard" BEFORE UPDATE OR DELETE ON "ador"."collection_review_events"
  FOR EACH ROW EXECUTE FUNCTION "ador"."collection_review_events_guard"();
