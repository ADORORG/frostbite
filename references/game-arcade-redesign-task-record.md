# Games arcade redesign: preview catalog and a game screen

Branch `feat/game-arcade-redesign`, on top of `feat/game-page-stage` (`37e8e6e`). Owner request: the catalog should
be a real catalog with previews, not cards, with an optional image/video cover and an animated page; the game page
should span more area like a true gaming screen; the bottom cards should be fixed and collapsible.

## Decisions taken on the documented defaults (owner away; review at merge)

- Cover is an optional manifest field naming files in the game's own `assets/` (image required, clip optional), so it
  is published and served with the game from the platform's origin and needs no new upload system or storage.
  Only embedded games may have one. A manifest without one hashes as before.
- The dock is a sticky strip with a button per section, one section open at a time, closed by default; the cards'
  facts stay one click away and the stage never moves when it opens (it opens over the game).
- The old "Playable" lamp on the game page is gone for embedded games (the connection lamp says the live state).

## What was built

- Shared: `gameCoverSchema`, `GameCover`, `embeddedGameAssetPath`, `cover` on the manifest (embedded only).
- `@repo/ui`: `ArcadePreview` (still, optional clip when motion is welcome, stand-in when none), `ArcadeCatalog`,
  `ArcadeCatalogEntry`, `ArcadeTicker`, `ArcadeDock`; `catalog.css`, `dock.css`, stage rework (whole screen minus
  header and dock, title in the bar, back link, one-line bar on wide screens).
- Games feature: the list is a numbered wall of wide entries (preview first; ticker, moving grid floor, staggered
  entrance, camera drift, pulse; all under no-preference motion). The game page is the stage with a dock (Milestones
  with a reached count, About, What it asks for). Clicking into the game, Escape, or Hide closes the dock.
- FROST·BITE cover: `games/frostbite/assets/cover.svg`. Conformance checks cover files exist.
- Two real defects found on the way: duplicate region names (panel and card both labelled) and a bar that wrapped
  the Full screen button to a second line at 1280px; both fixed with tests.

## Evidence

Format, lint, typecheck (44 workspaces). Coverage: ui 100/99.16/100/100, feature-games 98.24/96.03/97.18/98.69,
shared 98.91/99/97.69/98.85, test-kit 99.1/96.62/98.25/99.42. 15 mutants, 14 killed; the survivor (a folder taken
for a file) drove a fixture and test, then died. Full e2e 362 passed, 38 skipped by design, 0 failed; games
snapshots regenerated and re-run stable. Not run: formal three-pass review; real phone.

## Known gaps

- No cover video exists yet (supported and tested, none supplied). No upload path for a cover other than the game's
  own folder. The milestone toast cannot show during full screen. Sample game has no cover (stand-in shown).
