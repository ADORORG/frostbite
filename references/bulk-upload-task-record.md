# Bulk image upload (#32)

Baseline: `107f020` on `feat/studio-bulk-items`.

## What was built

- Upload intents keep the name the file had (`upload_intents.file_name`, bare name only, bounded, enforced by a
  schema check and by `uploadFileNameSchema`); the library shows it as `fileName` (null for older uploads).
- `BulkUpload` (`@frostbite/feature-uploads/bulk`): choose or drop many files; each is checked on sight, sent under
  its own idempotency key, and reported on separately. At most the server's per-person unfinished-upload limit
  are being sent, and at most `bulkInFlightLimit` are under way, so the processing queue stays short.
  One shared watcher reads the library once per interval for the whole batch. Retry keeps the file's key and
  what it already did; cancel drops waiting files and aborts moving ones; a batch takes up to `bulkFileLimit`.
- `ArcadeFileDrop` takes `onFiles` for many files (`multiple`), `onFile` unchanged.
- The studio's Items step offers it under "Upload many images at once".

## Found while reviewing

- Polling the library once per image would have timed out any image that fell out of the newest page, and
  would have asked the server once per image per interval. Fixed with the in-flight cap and the shared watcher.
- Retrying many failed files at once would have broken the server's limit; retries now go back in line.
- A cap that counted only already-completed uploads let a fourth start; it now counts everything under way.
- `git checkout -- .` was run by mistake and removed uncommitted edits to tracked files; every one was
  re-applied and the full gates were rerun on the restored tree (results below are from that run).

## Evidence

- Gates on the final tree: env:check, format:check, typecheck, lint, repository:check, test:unit,
  test:integration, test:coverage, db:check, test:e2e all exit 0.
- New e2e: 12 named images plus one refused file, real storage and worker, desktop only.
- Mutation proofs (all killed): slots ignored, fresh key on retry, slot held until finished, file name not sent,
  batch limit ignored, settled on every image, refused file started, refusals retryable, cancel keeps waiting,
  in-flight cap removed, watcher never times out / keeps aborted / ignores state / hides errors / not shared,
  library hides file name, name allows a slash, file drop single / drops extras.
- Coverage of the new bulk files: 100% statements, branches, functions, lines.

## Not done / noted

- A server configured with fewer unfinished uploads than the default shows the "limit" message on some
  files; they can be retried. The client assumes the default policy (as `checkFile` already does).
