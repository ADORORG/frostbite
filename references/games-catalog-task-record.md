# W8-01 Versioned game manifest, games catalog and game detail

Baseline: `a6862fe`-descended branch `feat/w8-01-games-catalog`.

## What was built

- `@ador/shared/games`: the manifest (`schemaVersion` 1: id, title, summary, description, game version, network,
  external launch with a nullable play address, declared capabilities, declared milestones), `defineGame`,
  `defineGames` (identifiers unique; frozen), and `gameManifestHash` (a digest of every declaration).
  Milestones are data (id, title, description, criteria, `once` or `repeatable`). Declaring them claims nothing.
- `@ador/feature-games` (new workspace): `/games` and `/games/[slug]`, one "Games" navigation item. It replaces
  the empty games stub that lived in `@ador/feature-public-products`.
- `configs/games.ts`: one line per game; FROST·BITE registered with no play address (W8-02 makes it
  configurable), no capabilities and no milestones, since the host protocol and claim path do not exist.
- `docs/product/game-onboarding.md`: the template, the checks, and the path (GP-00 to GP-08) to milestones minted
  to a player's account. A game is added by writing a manifest and one line; no platform code changes.

## Honest states

A game without a play address is "Not playable yet". Capabilities and milestones are shown as declarations,
with the statement that the platform does not grant capabilities, cannot claim milestones on chain, and cannot
verify gameplay. Nothing in the pages implies minting.

## Evidence

- Unit and integration tests for the manifest (38), catalog, pages and registration; a template game fixture proves a
  new game appears with no other change; the platform's game list is validated against the configured chains.
- E2E: the games list, FROST·BITE page, unknown and invalid addresses, on four viewports with
  accessibility, keyboard, reduced-motion and visual baselines; navigation and home specs updated.
- Mutation proofs, all killed: 19 (url protocol, duplicates, strictness, freezing, hash coverage, catalog lookups,
  slug validity, playable claim, declaration notes, play link, invalid vs unknown, empty state, navigation).

## Not done

Milestone attestation, claims and minting (GP-00 to GP-08; ADR-018 is proposed), the play-address configuration
(W8-02) and hosting modes (W8-03). Reviewed by gates and mutation; the three-pass convergence loop was not run.
