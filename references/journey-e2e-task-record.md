# Journey e2e task record (UX-5)

Baseline: `460b1c8` (branch `feat/journey-e2e`, stacked on `feat/studio-layout`).

## What was built

`tests/e2e/tests/journeys.spec.ts`: five click-only journeys (visitor, never-applied person, approved creator,
reviewer, staff without the reviewer role) started once at `/`; the spec removes `page.goto` after the first
load so a back-door address fails the test. All four viewports run them (they only read); desktop and mobile
keep a baseline of the top bar with the account menu open for each signed-in role (8 pictures).

## Evidence

- Journey spec: 20 passed (5 journeys x 4 viewports). Full gates run after this commit (see below).
- Mutations (against a rebuilt app, since e2e runs the build): typing an address mid-journey fails with the guard's
  message; renaming the reviewer's "Creator reviews" navigation entry fails the reviewer journey.
- Found while writing it: the public collection page has a "Browse collections" link, not a breadcrumb like the
  private pages; the journey uses the link. Left as is (a visitor's pages stay lighter), noted in S15.
- Review: single new spec file (about 190 lines) read whole; M5 above; M11 limits met. Verdict **Converged**.
