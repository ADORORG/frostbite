# Studio layout task record (UX-4 and #31)

Baseline: `23eb8a1` (branch `feat/studio-layout`, stacked on `feat/creator-review-queue`).

## What was built

- `arcade-stack--tight` and `arcade-columns` in `@repo/ui` (documented in its README): a heading sits close to
  its content (fixes the gap under "What you sent"), and a main block and a side block sit beside each other from 64rem.
- The reviewer's detail page uses them: no panel inside a panel, details and history beside the decision.
- E2E: the public collection card baseline is now shot alone and after fonts load (root cause of the wide flake in
  full runs: another spec's collection moved the card to a fractional offset).

## Evidence

- Gates: env:check, format:check, typecheck, lint, repository:check, test:unit, test:integration, test:coverage,
  db:check pass; test:e2e 229 passed, 6 skipped. Creator-admission feature coverage 97.7 / 92.6 / 97.4 / 98.0.
- Mutations: dropping the tight class and dropping the columns layout each fail the new layout test. CSS itself is
  proven by the four-viewport baselines, which were read (mobile gap gone; desktop two columns).
- Review: small diff (CSS, one component, one spec); M1 read, M5 mutations, M10 no new exports, M11 file limits and
  prettier/lint clean. No findings after the change. Verdict **Converged**.
