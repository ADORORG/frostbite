# Starter Game (template)

The template `pnpm game:new <id>` copies into `games/<id>`; it is not a game of the platform and is never listed. It is a small finished game:
a marker sweeps a lane and the player catches it in a zone, which speeds it up; a miss ends the run. It shows every piece a game has, so
a new game is made by replacing the rules and the words, not by building the pieces again. (`game:new` writes the new game's own README.)

## Layout

- `index.html`, `styles.css`: the page, with the steady phone layout and the sound panel's place.
- `src/rules/`: the rules, a pure seeded state machine with its milestones, free of the page and the platform.
- `src/session.ts`, `src/replay.ts`, `src/sample-run.ts`: a run as played, the verifier the platform replays, and one legal run for it.
- `src/screen/`, `src/guide.ts`, `src/audio.ts`, `src/feedback.ts`: drawing, controls, the two cards, and sound.
- `src/main.ts`: the page and the calls to the platform. It saves nothing itself.

## Test commands

`pnpm test:unit`, `pnpm test:integration` (bundles the game and runs it against a simulated host), `pnpm test:coverage`.

## Ownership

Platform games team. If the platform's pieces change, this template and the generator's tests change with them.
