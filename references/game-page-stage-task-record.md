# Game page: the game as the main stage

Branch `feat/game-page-stage`, on top of `feat/game-fullscreen` (`0f20c79`). The owner chose layout A of four
sketched options (A stage + slim bar, B cabinet, C stage + side rail, D theatre + tabs) and four extras.

## Why A and not D (theatre + tabs)

The page must keep three things visible without a click: the player's milestone progress, the wording that a
milestone cannot be minted and is only the game's report, and what the game asks of the platform (repository rule:
claims about state stay visible and truthful). Tabs hide them, and tabs are harder on a phone. A tab view of the
cards is a small later change if the owner wants the more immersive look.

## What was built

- `@repo/ui` stage pattern (`ArcadeStageHead`, `ArcadeStage`, `ArcadeInfoRow`, `ArcadeInfoCard`, `stage.css`; named "info" because studio pages already own `.arcade-card`, which the first version collided with and broke 20 other pictures until the full run caught it): one title
  line with the version, network and state beside the name; a slim bar that stays below the site header while the game
  is in view; the game as the stage (full width, `min(85vh, 60rem)`); small info cards in a row below. Not sticky where
  the header is tall or the screen short (small widths and heights).
- Games feature: the old big info card is gone. About (summary, description, network, declarations digest), What it
  asks for, and Your milestones (state, how each is earned, once per player; the separate declared-milestones panel
  was folded into it) are cards under the game. A game that is not played here gets a "Where to play" card.
- Extras: a notice over the game when a milestone is reported while the player is there (never for ones they had;
  six seconds; polite live region); an offer of full screen on a phone held sideways (landscape, short, touch; the
  browser requires a tap, so it is a prompt with Full screen / Not now); the digest folded into About; the "Press
  Esc" hint hidden on touch screens.

## Evidence

Format, lint (44 workspaces + policy), typecheck. feature-games 64 tests (coverage 98.18/96.19/97.05/98.63), ui 67
(100/98.92/100/100). Real browser (`game-stage.spec.ts`, plus updated game specs): order and size of title, bar,
stage and cards; the bar sticks below the header on large screens and does not on small; the milestone notice
appears and clears and is not repeated after a reload; the phone prompt appears only for a touch device in
landscape, declines, and takes the frame full screen. Snapshots regenerated, stable on a second run (the game's
inside is left blank in the picture; it is covered by its own spec). 16 mutants killed after three test gaps found
by the first round were closed.

## Not done

A tab view (option D). The notice cannot show while the game is full screen (the frame covers the page). The
non-embedded "Where to play" page has only declarations for milestones.
