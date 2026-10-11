# Items from a CSV or JSON file (#33)

Baseline: `250a432` on `feat/studio-item-import`.

## What was built

- `POST /api/v1/collection-drafts/items/import` (`importCollectionItems`): rows name their image by upload file
  name; `dryRun` reports without writing; a real import adds every row in order or none, in one transaction
  that locks the collection; idempotent by key (each item gets `key#index`; same key and content replays,
  different content conflicts). Report problems: `image-not-found`, `over-supply`. Item limit and
  creator-eligibility rules are those of adding one item.
- Images resolve among the creator's own processed item images by lower-cased file name; the newest upload
  of a name wins.
- Browser: CSV (comma, semicolon or tab; quotes; byte-order mark) and NFT-style JSON are read in the page,
  checked row by row, then checked on the server; adding is a separate step. Templates download from the page.
  Unknown CSV columns are refused rather than dropped.
- Limits: `collectionLimits.importRows` (500) per file, `importFileMaxBytes` per file.

## Evidence

- Final gates: env:check, format:check, typecheck, lint, repository:check, test:unit, test:integration,
  test:coverage, db:check exit 0 on the final tree; test:e2e exit 0 on the tree before two test-only file
  splits (the splits changed no behaviour; the new import spec was also run alone: 1 passed).
- Real-service e2e: images uploaded with names, a file with a missing image and a file past the supply are
  refused with the row named, the fixed file adds three items, traits read back from the API and the edit form.
- Mutation proofs, all killed: 13 server rules (owner, purpose, processed, case, newest wins, supply,
  all-or-nothing, dry run, replay, fingerprint, positions, revision, item limit) and 32 client/operation ones.
- Coverage of the new files is 100% statements and branches.

## Noted, not done

- A file over 500 items is split by the creator; a request is also bounded by the HTTP body limit.
- Pricing is not part of this; it belongs to launches (#34).
