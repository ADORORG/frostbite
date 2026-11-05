# UX-3 task record: area-aware navigation

Branch `feat/studio-journey`. Baseline: the journey docs commits `608bd65`, `d637a73`.

## Built

- Manifest contract: each navigation link names an `area` (`main`, `studio`, `admin`, `account`, `footer`)
  and may give an `order` (0-99, default 50).
- `@frostbite/plugin-kit/navigation`: links in display order with their area; `markCurrent` marks the page
  or section being shown (longest matching parent, never a sibling that shares a prefix).
- `apps/web/src/server/navigation.ts`: the links for a visitor, for a signed-in person, and for a session
  on a public page, so the bar does not change between public and private pages. Failure falls back to
  the visitor's links.
- `@repo/ui` shell: a short bar (public links, one entry per work area, one account menu), an area sidebar
  when the area has more than one link (tabs on narrow screens), breadcrumbs only where they have a link
  to follow, footer links. A work area's entry opens the first link the person may see.
- Wizard stepper: connected progress row with done/current/to-do state, scrolling sideways on narrow screens.
- Feature registrations assign areas and order; "My collections" became "Collections" (studio),
  "Apply to create" became "Creator application".

## Evidence

- Typecheck, lint, repository check, env check, db check, unit, integration, coverage, and the full
  Playwright matrix (four viewports) were run; final figures are in the commit message.
- Navigation e2e specs rewritten as click-only journeys for a visitor, a creator, staff, and a reviewer.
- Screenshots read before baselines were accepted: studio list and wizard (mobile and desktop), review
  queue (mobile), public page (mobile), admin (tablet and desktop).
- Mutation proofs: 23 mutations over the contract, ordering, current-marking, model, shell, resolver,
  registrations, and stepper; every one killed for the intended reason after the repairs below.

## Audit findings repaired

1. A new unit test file was never run (wrong extension for the package's include pattern).
2. The active work area's bar entry had no assertion (survived mutation); a test now pins it.
3. A page nested under an area's first link lost its breadcrumb in one mutation; a test now pins it.
4. Mutation runs through the e2e workspace used a stale build; reran through the root command.
5. Keyboard tab-order checks assumed no breadcrumb; helper `passBreadcrumb` steps through its links.

## Left for other tasks

UX-2 (page split, flow fixes), UX-4 (layout), UX-5 (journeys for all roles). See findings R1-R7.

## Convergence

Reviewed together with UX-2 over `392a216~1` to the working tree; verdict Converged (see the review table in
`references/studio-flow-task-record.md`). Navigation-specific results: the shell, sidebar, account menu and
breadcrumb branches are fully covered (`@repo/ui` 100% on all four measures), and every shell path has a
mutation proof.
