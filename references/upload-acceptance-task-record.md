# W3-08 — Upload acceptance tests

Status: completed 2026-10-09; formal deep review Converged (see "Review")
Baseline: `4571aff`
Depends on: W3-01 through W3-07 (completed). Closes Week 3.

## Objective and done criteria

Close the Week 3 acceptance gate with evidence a reader can follow: every bullet maps to named tests,
the user-facing ones run end to end on real services, and each test was shown to fail when the behavior it
guards is broken. Done means no gate bullet rests on a unit test alone where a real-service run is
practical, and the gaps the mapping exposes are closed.

## Acceptance matrix

Gate: **"Valid PNG/JPEG/WebP assets upload without passing through the API process."**

- `uploads-acceptance.spec.ts` (browser) > valid PNG, JPEG, and WebP uploads go straight to storage and are
  processed: three real images (PNG, JPEG, WebP) uploaded through the page, each ends as a processed
  thumbnail; each upload is exactly one `PUT` of its own content type to the storage origin, and no request
  to the application origin carries an image body.
- `uploads.spec.ts` > a signed-in user uploads an image and sees its processed thumbnail, which survives a
  reload (never enlarged, decoded by a real browser).

Gate: **"Disallowed types, mismatched MIME, oversized files, oversized dimensions, and unauthorized access
are rejected."**

| Case                             | Evidence                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Disallowed type, in the browser  | `uploads.spec.ts` > an unsupported file type never reaches the server                                                   |
| Disallowed type, at the API      | acceptance(-api) > the API refuses anonymous callers, missing origins, unsupported types, and oversized declarations    |
| Not an image / undecodable       | `uploads.spec.ts` > a file that is not an image is rejected…; a structurally valid but undecodable image is unusable    |
| Mismatched MIME                  | acceptance(-api) > bytes that do not match their declared type are rejected with a plain reason                         |
| Oversized file, declared         | acceptance(-api) > the API refuses … oversized declarations (400 `invalid_request`)                                     |
| Oversized file, actual bytes     | acceptance(-api) > storage refuses an upload longer than declared, and completing nothing is a conflict                 |
| Oversized dimensions             | acceptance(-api) > an image with oversized dimensions is rejected before it is decoded                                  |
| Unauthenticated                  | acceptance (401 for an anonymous create); `uploads.spec.ts` (401 on the library; the page requires a session)           |
| Cross-site request               | acceptance (403 without the application origin)                                                                         |
| Another user's upload or library | acceptance(-api) > intent creation, completion, and processing are idempotent, and another user cannot reach the upload |
| Adversarial media (below the UI) | `@ador/media` adversarial and validation tests; the isolated processor's hostile-input tests                            |

Gate: **"Processing is idempotent and retryable."**

- Intent creation: the same idempotency key replays the same intent and a different request under it is a
  409 (acceptance, and `repository.integration.test.ts` > replays matching requests and rejects idempotency
  drift).
- Completion: a retry returns the same asset (acceptance; completion repository tests, including concurrent
  completion yielding one asset and one event).
- Validation and processing: replays return the persisted winner, concurrent runs record one outcome, and a
  storage failure leaves the asset pending or validated and retryable until storage returns
  (`validation-activity` and `processing-activity` integration tests).
- Delivery: through the real worker, database, and Inngest runtime (`apps/worker` pipeline integration):
  completion to a processed asset, recovery after a provider outage, a lost acknowledgement with the event
  published again yielding one run, a rejected upload ending without failing the run, and persistent storage
  failure leaving the asset retryable.
- From the browser: an interrupted transfer retried without starting over (`uploads.spec.ts`).

## Gaps the mapping exposed and closed

- The browser flows only ever uploaded a PNG; JPEG and WebP now run through the page (new tiny fixtures in
  `@ador/test-kit/images`, produced once with the pinned `sharp` and verified against their own headers).
- Nothing end to end proved that the application never receives image bytes; it now does.
- No API-level negative tests existed for anonymous callers, a missing origin, an unsupported type, or an
  oversized declaration, and no test showed storage refusing more bytes than declared.
- A repository test claimed to prove that another user cannot complete an intent but used an already-expired
  intent, so it would have passed without the ownership check; a live-intent case now proves it.

## Test infrastructure

Four new fixture users (separate sessions and quotas per concern) and shared helpers extracted from
`uploads.spec.ts` (`signIn`, `chooseImage`) and for the API checks (`src/upload-api.ts`). The acceptance work
is two specs, the browser flows (`uploads-acceptance.spec.ts`) and the API contract and ownership flows
(`uploads-acceptance-api.spec.ts`), split to stay under the 300-line limit; both run on the desktop project
only, like the other real-service spec. The helpers take only the slice of Playwright they use, so they have
plain unit tests. Every API response is parsed with the shared contract schemas, so contract
drift fails the acceptance run as well.

## Mutation proof

Nine deliberate breaks of product code, each of which must turn the acceptance spec red: the declared-type
check, the dimension limit, the origin check, the signed content length, the per-user library filter, the
idempotency fingerprint, the avatar size limit, the completion replay path, and the completion ownership
filter. Seven were caught by the browser/API spec. The last two sit below the HTTP path (the service
pre-checks ownership and existing assets before the repository runs), so they are proven by the repository
tests; the ownership one needed the new live-intent test.

## Known limits

- Real R2 is still unverified; this suite runs against the S3 stand-in.
- Oversized-dimension and mismatched-type cases use the shared PNG fixtures; the exhaustive hostile-media
  matrix lives in `@ador/media`, not the browser run.

## Verification evidence (final tree, 2026-10-09)

`env:check`, `format:check`, `typecheck`, `lint`, `test:unit`, `test:integration`, `test:coverage`,
`db:check`, and `build` all exit 0; `test:e2e` passed 131 tests (125 existing plus six acceptance tests).
The e2e package is at 100% lines, functions, and statements and 95% branches; the longest changed file is
187 lines. The repository's own 300-line policy caught the first draft of the acceptance spec (310 lines),
which is why it is two specs.

## Review

Formal deep review (`deep-review-until-clean`) of the W3-08 diff, which is test code, fixtures, and
documentation: **Converged**. Methods used: whole-file read (M1), producer/consumer check (every API
response is parsed against the shared contract, and the matrix against the tests that exist) (M4), mutation
proof of the product code behind each claim (M5), an AST check for assertions, `unknown`, and `any` plus a
file-length audit (M11), coverage-hole walk (M6), adversarial input enumeration (M8), and hunk narration
(M2). The review found and fixed: a spec over the length limit, helper modules without unit tests (the e2e
package fell below its coverage threshold), an ownership test that was decorative because its intent was
already expired, and an ownership check on the repository's completion path that no test reached. The
review was lighter than for the product tasks because the diff is tests; all product code it touches is
unchanged.
