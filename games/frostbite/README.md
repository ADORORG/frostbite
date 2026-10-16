# `@game/frostbite`

FROST·BITE, the platform's first game, played by the platform itself in the isolated game frame (`/games/frostbite`). It is
client-only: no network, no server of its own, nothing that touches a chain. The page says it is a simulation. Its manifest is
`configs/games/frostbite.ts`.

## Parts

- `src/legacy/` and `src/legacy-boot.ts`: the original game, copied from before the platform and **frozen** (see
  `src/legacy/README.md`: it exceeds the 300-line policy, is exempt by path, and may only shrink). Nothing new goes here.
- `src/main.ts`: gives the legacy code what it expects from the platform (React, a `localStorage` backed by the SDK's saves, a
  way to report milestones), then starts it and mounts the ice-field cabinet.
- `src/platform/`: the milestone bridge (a mark the game makes becomes a milestone only if the manifest declares one of that
  name) and the storage keys the game persists.
- `src/ice-field/`: the **ice-field cabinet**, new compliant code beside the legacy game: a 5x5 field of frost tiles, played
  through the same rules the platform replays, recording its run as it goes. Signed in, it plays on a run the platform issued
  (`run.start`) and submits the record at "End run" (`run.submit`); otherwise it plays on a local seed and says its milestones
  are the game's own report.
- `src/snake/`: the **SAT SNAKE cabinet**, the real-time snake game ported to a fixed-step simulation (a timer calls the rules'
  `moveOnce` each tick; only the player's turns and the tick of each are recorded). Same launcher/panel pattern as the ice
  field; its mines are in plain view. The milestone is `snake-ten`.
- `src/cabinet/`: what the cabinets share: the host type, the platform-run hook (`usePlatformRun`: begin a run, send the
  record), the record view, the seed, and the mark naming.
- `src/verifier/`: the deterministic rules (`ice-field.ts`, `snake.ts` with its geometry in `snake-board.ts`), a seeded
  generator, and a sample run. `frostbite.ts` combines the cabinets behind one verifier (`combineCabinets`; a record names
  its cabinet in `config.cabinet`). `src/replay.ts` publishes it: the SDK's build turns it into `verifier.js` and
  `verifier.json`, and the manifest pins the digest.

## Public API

Package exports `./verifier` and `./verifier-sample` (the rules and the sample run, for tests). The game itself is built by
`apps/web/scripts/build-games.ts` into `apps/web/public/play/frostbite`.

## Invariants

- The rules use no clock, no `Math.random` and no I/O; a conformance test (`@ador/game-verification`) checks it.
- A change to the rules is a change to the digest in `configs/games/frostbite.ts`; a test in `apps/web` fails until they agree.
- The cabinet uses classes only (the frame's policy forbids inline styles), writes only accepted inputs into the record, and
  never says a run is verified unless the platform replayed it.
- `first-cashout` is a simulation event and is never replay-verified.
- A change to any cabinet's rules raises `frostbiteVerifierVersion` and the manifest's version and digest.
- The snake's rules use ticks, never a clock; the timer is in `src/snake/timing.ts` and only paces the screen.
- The ice field hides its mines but the browser knows the seed, so "replay-checked" means the run followed the rules and nothing
  more (`docs/product/run-record.md`).

## Tests

`pnpm --filter @game/frostbite test:unit` (rules, session, screen), `test:integration` (the bundled game in a simulated
platform), `test:coverage`; the real-browser tests are `tests/e2e/tests/frostbite.spec.ts` and `ice-field.spec.ts`.

## Ownership

The games platform owner.
