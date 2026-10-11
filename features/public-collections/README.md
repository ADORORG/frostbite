# Public collections feature

The public catalog of approved collections: a list at `/collections` and a page for each at
`/collections/[slug]`, where the slug is the collection's identifier. Register
`createPublicCollectionsFeature` once in the feature registry with the provider registry and the chain
options; removing that line removes both pages and the navigation entry.

## What is shown, and what is not

- Only collections that **currently have an approved version**: a submission in the approved state whose
  creator is still an approved creator (`@ador/collections`, `ApprovedVersionReader`). A collection that
  is submitted, in review, rejected, suspended, revoked, or whose creator was suspended or revoked, is
  reported as "Record not published", the same words as an identifier that never existed.
- The page shows the **frozen version that was approved**, never the creator's current draft, so editing
  after approval changes nothing public.
- `src/application/public-model.ts` is the allowlist: every public field is copied across explicitly.
  The creator's identity, the review history and notes, reason codes, the content hash, and the draft
  revision never reach a page, and integration tests assert it against real records.
- Approval is stated honestly everywhere: "Approved by review. Not yet minted." Approval is a review
  decision, not a launch, listing, or sale.
- A catalog that cannot be read says "Catalog unavailable", never an empty or missing catalog.

## Images

Images are the creator's own processed uploads, signed for display through the uploads library
(ADR-016): only assets frozen into an approved version are ever signed, as their creator's own. The
signed renditions are short-lived and never stored; a preview that is not available shows a placeholder.
Public derivatives on an asset domain (ADR-004) are a later step.

## Structure

`src/application` (the catalog and the public model), `src/ui` (server components: index, detail, and the
empty, unavailable, and not-published states), `src/runtime.ts` (lazy catalog over the uploads context),
`src/paths.ts`. There is no client JavaScript and no API route.

Run `env:check`, `typecheck`, `test:unit`, `test:integration`, `test:coverage`, or the browser checks
(`tests/e2e`, `collections-public-quality.spec.ts`, and the journey in `collections-review.spec.ts`).
Platform engineering owns this feature.
