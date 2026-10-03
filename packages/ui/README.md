# `@repo/ui`

Shared Adorbitals design-system package. It owns semantic visual tokens, accessible primitives,
arcade components, and platform patterns derived from the immutable standalone arcade reference.

## Public API

- `@repo/ui/arcade` exports `AppShell`, `ArcadeButton`, `ArcadePanel`, and `StatusLamp`.
- `@repo/ui/styles.css` installs tokens and shared component styles.
- `ArcadeModal` lives in `src/components/arcade-modal.tsx` and accepts a title, trigger label,
  and arbitrary children. It owns hydration-safe opening, native focus behavior, dismissal,
  unique accessible labels, and shared compact modal styling. It has no wallet dependencies.

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
