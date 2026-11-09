# Hot games (HOT-1)

The platform shows which games are being played the most, in three places: a **Hot right now** rail on the landing page, the order of the games list, and a
**Hot** sticker with a heat meter on a game's card.

## What counts, and how it is counted

- **A play is a run that was started.** The page that frames a game counts it when the game asks the platform for a run (`run.start`): a game cannot count
  itself, and a visitor who is not signed in counts too (the platform answers their run "signed out", and the start is counted all the same).
- `POST /api/v1/games/play` (`recordGamePlay`, public, `{ gameId }`) adds one to `game_play_days` (game, UTC day, count). A game the platform does not list is
  "not found" and leaves no row. A row names no one.
- **Soft by design.** Nothing proves a start was a person. The limit is `recordGamePlay` in `configs/rate-limits.ts`: six a minute per address, answered 429
  over it (the page ignores that). Per-address limits need `TRUSTED_PROXY_HOPS` (blank means 1; the local stack sets 0, so nothing is limited there).
  Counts are never shown as numbers, because they are not exact.

## What is hot

`packages/game-runs/src/hot-policy.ts` (a versioned record): the runs started in the last 7 days (today counting as the last), a game under 5 is not ranked,
the first 3 ranked are **hot**, every ranked game has a **heat** from 1 to 5 against the busiest (`heatLevels`, `packages/shared/src/games/plays.ts`). A tie
goes to the game named first, so the order does not flicker. A platform where nothing has been played enough ranks nothing, and every page looks as it did.

## The design

An arcade heat language, in `packages/ui` (`patterns/heat.tsx`, `styles/heat.css`), words in `features/games/src/domain/heat-copy.ts`:

- **HOT sticker**: an ember gradient tag with a pixel flame on the picture's corner (flickers in steps; still for reduced motion).
- **Ember rim** around a hot card, in place of the cyan one (pulses slowly; still for reduced motion).
- **Heat meter**: five rising bars lit yellow, ember, then red, with a word that climbs with it (Warming up, Warm, Heating up, Hot, Blazing). One name for a
  screen reader ("Heating up, 3 of 5"), not five bars.
- The rail leads with the ranked games under the title "Hot right now"; the games list puts ranked games first and numbers only them.

The pages read the ranking on the server (`createPlaysResolver`, kept 60 s in the process) and fall back to no ranking if the database cannot be read.
