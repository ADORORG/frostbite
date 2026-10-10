# `@repo/ui`

Shared Adorbitals design-system package. It owns semantic visual tokens, accessible primitives,
arcade components, and platform patterns derived from the immutable standalone arcade reference.

## Public API

- `@repo/ui/arcade` exports `AppShell`, `ArcadePanel`, `StatusLamp`, `AccessState`, and the controls
  `ArcadeButton` (a link), `ArcadeActionButton` (a `<button>`), `ArcadeSelect`, `ArcadeTextField` (a labelled single-line input or textarea with hint and error),
  `ArcadeFileDrop`
  (a real file input that also accepts drops), `ArcadeProgress`, `ArcadeBadge`, and `ArcadeMediaTile`.
- `@repo/ui/styles.css` installs tokens and shared component styles.
- `ArcadeModal` lives in `src/components/arcade-modal.tsx` and accepts a title, trigger label,
  and arbitrary children. It owns hydration-safe opening, native focus behavior, dismissal,
  unique accessible labels, and shared compact modal styling. It has no wallet dependencies.

`AppShell` takes the flat list of links, each with an `area`, and lays it out: `main` links and one
entry per work area (`studio`, `admin`) in the bar, `account` links in one menu (a lone link is shown
as itself), `footer` links in the footer, and, inside a work area with more than one link, that area's
sidebar (tabs on a narrow screen) and a breadcrumb. A work area's bar entry opens the first link the
person may see. The grouping is `buildNavigationModel` in `src/patterns/navigation-model.ts`; its areas
must match the manifest's (`@ador/shared/features`), which a type error at each page enforces. Guided
forms use the `wizard-steps` styles (a connected row that scrolls sideways on narrow screens).

Lists use `ArcadeFilterTabs` (buttons with counts and `aria-pressed`), `ArcadeEmptyState` (title, one
sentence, one action), and the `arcade-card`, `arcade-cards`, `arcade-callout`, and `arcade-disclosure`
styles. `ArcadeButton` takes an optional `ariaLabel` for links whose words repeat on a page.

The shared form styles also give `.arcade-facts` (a label and value list that stacks on narrow screens)
and lay out radio and checkbox labels beside their control.

Consumers compose these exports and must not copy their CSS or use raw brand colors. Status tones
describe view state only; the caller remains responsible for deriving truthful state from its
authoritative domain model.

## Dependencies and configuration

The package depends only on React and React DOM. Font variables are supplied by the delivery
application so each host can self-host the approved Bungee, Chakra Petch, and Press Start 2P faces.
No environment configuration is consumed here.

## Verification

Run `pnpm --filter @repo/ui typecheck`, `test:unit`, `test:integration`, and `test:coverage` from the
repository root. Shared interactions and semantics require positive and negative tests; route-level
responsive and accessibility behavior belongs in Playwright.

Operational ownership: platform design-system maintainers.
