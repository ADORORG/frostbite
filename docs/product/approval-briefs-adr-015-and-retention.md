# Approval briefs: ADR-015 (worker hosts the workflow endpoint) and private-object retention

Status: preparation. Documents only. Both items are waiting on the product and engineering owners; neither is
accepted by this document. For each: what is being decided in plain terms, what is already true in the code,
the options, a recommendation, and what approving or rejecting changes.

---

## 1. ADR-015: the worker service hosts the signed workflow endpoint

Full text: `docs/decisions/ADR-015-worker-hosts-signed-workflow-endpoint.md` (status: proposed, 2026-10-06).

### The decision in plain terms

When an image is uploaded, a background job checks it and makes the small copies the site shows. That job is
started by the workflow provider (Inngest) calling a URL on our side. The question: does that URL live in the
web application, or in the separate background worker?

ADR-009 said the web application. In practice the image decoder (a native library) cannot run inside the
web application's production build: the build leaves the decoder without its library and as a file Node
refuses to load. Each workaround tied the web app to a native decoder, which ADR-004 wants kept away from
the process that serves visitors. So the proposal is: the worker serves the endpoint and runs the decoder in
an isolated child process; the web app never loads a decoder.

### What is true today

- **Built:** `apps/worker` implements the proposal. It serves the signed `/api/inngest` endpoint (the provider
  verifies the signature before any activity runs), `GET /health` (liveness), the outbox relay, and the
  abandoned-upload cleanup. Bodies over 1 MiB are refused with 413 before buffering.
- **Verified:** the full upload-to-processed path runs through it in the end-to-end suite, on every gate run
  (uploads, bulk upload, collections). The manual-test stack also starts it.
- **Not done:** the production topology. A second deployable (an OCI image target) has to be provisioned and
  given the same environment inventory as the web app, and the provider registered against the worker's
  public URL.

### Options

1. **Approve as proposed (recommended).** Worker hosts the endpoint. Web stays small. Web and worker scale
   independently. Cost: one more service to run, health-check and log (W8-06, W8-07).
2. **Reject: keep the endpoint in the web app and call a remote media service.** Needs a new remote image
   processor adapter (HTTP to a media service) behind the same port. It still needs a second service for
   decoding, so it removes none of the operational cost and adds a network hop and an API to secure.
3. **Reject: force the decoder into the web build.** Rejected by the ADR's analysis (fragile bundler tracing,
   native dependency in the request path).

### What approval changes

- ADR-009's topology sentence is amended: the web deployable serves the UI, studio and `/api/v1`; the worker
  serves `/api/inngest` and runs the relay and cleanup.
- Deployment checklist items become mandatory: provision the worker with the typed environment (ADR-012,
  minus browser-only keys), register Inngest at the worker URL, add its health check and a log stream.
- No code changes; the implementation already matches.

### What rejection costs

Moving the endpoint back is small (one route file plus the resolver) but the decoder would then have to run
in a remote service (option 2), which is a new adapter and service. The ADR notes the port, activities and
stored state do not change either way.

### Recommendation and acceptance record

Approve. It records what exists and is verified, and the alternative costs more.

```yaml
status: proposed
decision: "worker hosts the signed workflow endpoint and the relay"
owner: "" # product + engineering
date: ""
follow_up:
  - "amend the topology sentence of ADR-009"
  - "provision the worker deployable with the ADR-012 environment inventory"
  - "register the workflow provider at the worker's public URL; add health check and logs (W8-06, W8-07)"
```

---

## 2. Private-object retention policy

Source of the open item: ADR-004 lists "draft, rejected, audit and published retention policies" as required
configuration before uploads ship; the milestone notes record "retention of rejected or failed assets'
private objects" and "whether intent rows are purged after 30 days" as open and not implemented.

### The decision in plain terms

Every uploaded file starts as a private object. Some of them end up used, some are refused, some are never
finished. How long do we keep each kind, and what then happens to it? The answer is typed policy
configuration (ADR-004), not code constants.

### What is true today

| Kind of private object                                                | What the system does now                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload never completed (reserved or failed intent)                    | After the cleanup delay (1 day) the worker's sweep marks it abandoned and removes the object, then records the removal. Never touches an object an asset points to. |
| Completed but refused (`rejected`, `unprocessable`)                   | Original is kept indefinitely. No sweep, no deletion, no policy.                                                                                                    |
| Processed image, in use by a collection item, cover, banner or avatar | Original kept; the small public copies are content-addressed and write-once. Collections reference assets with a delete-restricting foreign key.                    |
| Processed image, never used                                           | Original kept indefinitely. There is no delete feature for creators.                                                                                                |
| Image referenced by a frozen submission                               | Kept; a submission is immutable and names its assets, so these must outlive the creator's draft.                                                                    |
| Upload intent rows (the database record)                              | Each has a `retain_until` (30 days after creation) that nothing reads. They are never purged.                                                                       |
| After suspension or revocation of a creator                           | Nothing is deleted (ADR-007: neither action silently deletes private drafts or rewrites audit).                                                                     |

Values in the code today (defaults, replaceable by configuration): cleanup delay 1 day, intent retention 30
days, presigned URL life 15 minutes, derivative read URL 5 minutes.

### Decisions needed

| #   | Question                                                    | Options                                                                               | Recommendation                                                                                                                                                                                             |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Refused originals (rejected, unprocessable): keep how long? | Keep forever; delete after N days; delete immediately                                 | Delete after a fixed number of days (owner to name N), so a creator can still see why and an auditor can inspect, but a hostile or broken file does not sit forever. Record the deletion on the asset.     |
| R2  | Processed but unused originals                              | Keep while the creator is active; delete after N days unused; creator deletes by hand | Keep in beta; add a creator-initiated delete (refused while any collection, submission or avatar uses it). Revisit with storage cost data.                                                                 |
| R3  | Originals of approved or submitted collections              | Keep permanently; keep until a legal request                                          | Keep for as long as the submission exists; deletion only through a recorded moderation or legal action, never silently.                                                                                    |
| R4  | Intent rows after `retain_until`                            | Purge; keep forever; keep but strip fields                                            | Keep for beta (small, and the audit trail); define purge only when a volume or privacy reason exists. Either way the unused `retain_until` is either given a job or removed, so it stops implying a purge. |
| R5  | Account closure or revoked creator                          | Keep; export then delete after a notice period                                        | Keep during beta; define export and deletion with the privacy owner before public launch (ADR-007 export constraints apply).                                                                               |
| R6  | Legal or security hold                                      | Not defined                                                                           | A hold flag on an asset that blocks every deletion path, set only by a recorded staff action.                                                                                                              |

Open owner inputs: the number of days for R1, any storage budget that should drive R2, and who may set a hold.

### Constraints any answer must respect

- Never delete an object an asset, collection, submission or public page still needs (the cleanup already
  checks the asset link; every new deletion path must check every reference).
- Deleting is recorded (who or what, when, why) and idempotent; a failed removal is retried, not forgotten.
- Public, content-addressed copies are never deleted as a normal edit (ADR-004).
- Values are typed policy in the upload policy, validated at startup, not constants.

### What implementing it would take (after approval)

1. Add the approved values to the upload policy and its validation.
2. A sweep for refused originals (same pattern as the abandoned-upload sweep: claim in a transaction, remove,
   record, retry), with a store of "object removed" on the asset.
3. A creator delete with a reference check (R2), and an asset hold (R6).
4. Either a purge job for intent rows or removal of `retain_until` (R4).
5. Tests: positive, negative (referenced object survives), idempotence and retry, partial failure.

### Recommendation and acceptance record

Approve R1, R3, R6 for beta with the owner's number for R1; keep R2, R4, R5 as stated and revisit before the
public launch.

```yaml
status: proposed
decision: ""
owner: "" # product + security
date: ""
refused_original_retention_days: ""
unused_processed_original_policy: "keep in beta; creator delete refused while referenced"
submitted_collection_originals: "kept while the submission exists"
intent_row_policy: "keep in beta; give retain_until a job or remove it"
account_closure_policy: "to be defined with the privacy owner before public launch"
legal_hold: "asset hold flag set only by a recorded staff action"
follow_up:
  - "add values to the typed upload policy"
  - "sweep for refused originals; creator delete with reference check; asset hold"
```
