# Runbook: upload failures

Status: **early draft (W8-07).** Written from the code as it is today; nothing below has been exercised
against real R2 or a deployed worker. Commands are read-only unless marked **write**. There is no structured
error logging yet, so diagnosis uses the database, the response's `correlationId`, the worker's logs and the
Inngest and Cloudflare dashboards.

## The path an upload takes (what can fail where)

1. **Intent** (`POST /api/v1/uploads/intents`): declares type, size, purpose and file name; reserves a slot
   (at most 2 unfinished uploads per person) and returns a presigned PUT URL valid 15 minutes.
2. **Transfer**: the browser PUTs the bytes straight to the private R2 bucket (CORS must allow the site's origin).
3. **Complete** (`POST .../intents/complete`): the server checks the object exists with the declared size and
   records an asset (`pending-validation`) plus an outbox event, in one transaction.
4. **Relay**: the worker's outbox relay publishes the event to Inngest.
5. **Workflow**: Inngest calls the worker's signed `/api/inngest` endpoint: validate the bytes, then decode and
   make derivatives. The asset becomes `processed` (public copies exist) or `rejected` / `unprocessable`.
6. **Library**: the browser polls the library until the asset is final; images are shown through short-lived
   signed URLs (5 minutes).

Components: web, **worker** (hosts the endpoint, relay and cleanup; `GET /health` is liveness only, it says
nothing about the database, storage or Inngest), Postgres, R2 (private and public buckets), Inngest.

Asset states: `pending-validation`, `validated`, `rejected`, `processed`, `unprocessable`. Intent states:
`reserved`, `completed`, `cancelled`, `failed`, `abandoned`.

## What the person sees, and where to look

| Message in the product                                                                    | Likely cause                                                                  | First check                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| "You may have reached the limit of active uploads"                                        | 2 reserved intents not finished (a stuck tab, or a bulk batch in another tab) | Section A                                                                      |
| "Only PNG, JPEG, and WebP" / too large                                                    | Client check; or server `invalid_request`                                     | The file; limits per purpose (25 MB item and cover, 15 MB banner, 5 MB avatar) |
| "The file could not be sent. Check your connection" / "storage did not accept the upload" | Network, expired URL (15 min), CORS, R2 credentials                           | Section B                                                                      |
| "Processing is taking longer than usual"                                                  | Worker, relay or Inngest not progressing                                      | Section C                                                                      |
| "The file is not a valid image", "too large in width or height" and similar               | The file was refused; copy is in the product                                  | Section D                                                                      |
| Image tile says "Preview unavailable"                                                     | Processed but renditions could not be signed                                  | Section E                                                                      |
| Image missing from the library                                                            | Library shows the newest 48 only                                              | Section F                                                                      |

Ask for the `correlationId` and the approximate time; for a specific upload, the asset or intent id (shown on
the image page) or the file name (kept with the upload).

## A. Upload slots full (`conflict` on create)

```sql
select id, state, purpose, file_name, created_at, expires_at
from ador.upload_intents
where user_id = '<user-id>' and state = 'reserved' and expires_at > now();
```

Two rows means the user is at the limit. They free themselves: completing frees the slot; an unfinished one
expires after 15 minutes. If rows persist past `expires_at`, they no longer count (the limit counts only
unexpired reserved intents). Nothing to fix unless a client is retrying in a loop; a bulk upload sends at
most two at a time.

## B. Transfer to storage fails

1. URL expired: the presigned URL lasts 15 minutes. Retrying creates the same intent (same idempotency key)
   with a fresh URL; the product's Retry does this.
2. CORS: the private bucket must allow `PUT` with `content-type` from the site's exact origin
   (`docs/operations/preview-environment-checklist.md`, R2 section). A changed hostname breaks it at once.
3. Credentials: `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` valid, and the token allows object write on the
   private bucket. `pnpm --filter @ador/provider-object-storage-r2 smoke` checks storage behavior.
4. A completed intent whose object is missing (`missing-object`): the browser did not finish the PUT. The user
   retries; completion is idempotent.

## C. Stuck in processing (`pending-validation` or `validated` for too long)

Find the asset and its event:

```sql
select a.id, a.processing_state, a.created_at, a.validation_completed_at, a.processing_completed_at
from ador.assets a where a.user_id = '<user-id>' and a.processing_state in ('pending-validation','validated')
order by a.created_at desc limit 10;

select id, status, attempts, available_at, delivered_at, failure_reason, lease_expires_at
from ador.outbox_events
where event_name = 'uploads.assetprocessing.requested.v1' and status <> 'delivered'
order by occurred_at desc limit 20;
```

- Outbox rows `pending` and old: the relay is not running or cannot reach Inngest. Check the worker is up
  (`/health`), its logs, and `INNGEST_EVENT_KEY` / `INNGEST_BASE_URL`.
- `delivering` with an expired lease: a relay died mid-delivery; the next pass reclaims it.
- `failed` with a `failure_reason`: delivery gave up. Fix the cause first (key, URL, outage). Re-queueing is a
  **write** and **has not been verified**: the intended operation is to set the row back to `pending` with its
  failure and lease fields cleared and `available_at` now; test it on a copy of the data before using it in
  production.
- Outbox `delivered` but the asset is still pending: Inngest received it, the function has not finished. Open
  the Inngest dashboard: run failed (read its error), retrying, or not started. The usual causes: the worker's
  `/api/inngest` is unreachable from Inngest (URL, TLS, port), the signing key does not match
  (`INNGEST_SIGNING_KEY`), `INNGEST_DEV=true` in a deployed environment (must be false), or the decoder crashed
  (worker logs).
- Many assets pending at once: worker down or overloaded, or Inngest incident. Restore the worker first; runs
  are retried by Inngest.

## D. Refused images (`rejected`, `unprocessable`)

`rejection_reason` says why:

```sql
select id, processing_state, rejection_reason, created_at from ador.assets where id = '<asset-id>';
```

`unsupported-format`, `media-type-mismatch`, `malformed`, `animation-unsupported`, `size-exceeded`,
`byte-length-mismatch`, `dimensions-exceeded`, `pixels-exceeded` (8192 px side, 40 megapixels),
`decode-failed`, `decoded-size-mismatch`, `content-changed`, `processing-limit-exceeded`. These are decisions,
not outages: the person is told in the product and uploads a different file. Raise a ticket only for a
spike of `decode-failed` or `processing-limit-exceeded` (a decoder or resource problem), or a refusal of an
image the policy should accept (send the asset id to engineering; do not ask for the file by email).
Refused originals are kept until the retention policy is implemented (see the approval briefs).

## E. "Preview unavailable" on a processed image

The asset is `processed` but the library could not sign a rendition: either storage signing failed
(credentials, endpoint, an outage) or the asset has no stored renditions (an inconsistency).

```sql
select kind, content_type, width_pixels, height_pixels, created_at
from ador.asset_derivatives where asset_id = '<asset-id>';
```

No rows for a processed asset is a defect: report with the asset id. Rows present: check storage credentials
and the public/private bucket configuration and `R2_ENDPOINT`.

## F. Image "missing" from the library

The library lists the newest 48 uploads. An older image is not gone; open it by its image page, or use it in a
collection by file name (an item import matches by upload file name, not by the library page). Pagination is
a known backlog item.

## G. Abandoned uploads and storage cleanup

The worker removes the private objects of uploads that were never completed, one day after they were
reserved, and records it. Outstanding removals:

```sql
select id, state, cleanup_eligible_at, object_removed_at
from ador.upload_intents where state = 'abandoned' and object_removed_at is null order by cleanup_eligible_at;
```

Rows that stay for more than a few cleanup passes (the loop runs about every five minutes) mean storage
deletion is failing: check the worker's logs and R2 permissions (delete on the private bucket). A single
poison key can currently slow a batch (backlog item). Never delete an object by hand that an asset points to.

## Containment

- A flood of uploads from one account: rate limits are not in place yet (W8-06). Suspend the creator through
  the product, then investigate; do not delete rows.
- Suspected malicious file: the asset is isolated (decoding runs in a child process of the worker with
  limits). Do not open the original on a workstation; keep the asset id and escalate to security.

## Verify the fix

Upload a small PNG as a test creator: the image reaches `processed` in the library within a minute, appears
with a preview, and the outbox event shows `delivered`.

## Gaps to close (feed the backlog)

- Structured logs with correlation ids across web, worker and relay; an alert on outbox `failed` and on assets
  pending longer than a threshold.
- A readiness check that reflects database, storage and workflow provider (W8-06); today `/health` is
  liveness only.
- A verified operator action (or admin tool) to re-queue a failed outbox event and to re-run processing for
  one asset.
- Library pagination, and isolation of poison keys in the cleanup batch.
- Retention for refused originals and intent rows (approval briefs).
