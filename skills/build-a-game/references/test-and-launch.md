# Test, run and submit

Run these in the platform's repository. A command that could not run is unverified, not passed; say so.

## While you build

- `pnpm --filter @game/<id> test:unit`: the rules, session, screen, audio and progress, each alone.
- `pnpm --filter @game/<id> test:integration`: bundles the game and runs it in jsdom against a simulated host with storage and
  network blocked. A game that reaches outside fails. Page tests drive the real page: Enter starts, P pauses, Pause button, sound
  panel, a failed platform leaves the game playable.
- `pnpm --filter @game/<id> typecheck`, `lint` and `env:check`.
- `pnpm --filter @game/<id> test:coverage`: the shared test configuration fails the run below 90% lines, branches, functions and
  statements. `src/main.ts` and `src/replay.ts` are left out of the measure by the game's `vitest.config.ts` (they are the page's
  glue and the verifier's entry; the page is covered by the integration test), as in the finished games.
- `pnpm game:dev <id>`: a local page that frames the game in the same sandbox, rebuilds on reload, lets you sign the player in and
  out, connect a fake wallet, fire the tab-hidden and full-screen events, take a claim through its states, and read a log of every
  call. What it shows is made up; the platform's own rules decide what players get.
  Outside the repository the SDK's dev command does the same from a `game.json` (id, capabilities, milestones).

## The page test

`test/support/page.ts` in a finished game builds the game with the SDK's build, loads it into `runGameInSimulatedHost` (the test
kit's `./simulated-game-host`: it takes `backend`, `game`, `html`, `script` and optionally `services`, and returns the page's `window`,
the `replies` the host sent and the `pushes` it made on its own) and installs fake audio. To see what a finished run sends, lend it
`recordingRuns().runs` as `services: { runs }`, give the game the `run:submit` capability, and read `submitted` (each entry is a run id
and its record). Copy the page from the closest game and change the ids. jsdom prints "Not implemented: HTMLCanvasElement's
getContext()" when a test draws on a canvas; it is harmless.

## What a test must prove

- **Rules:** positive, negative and boundary cases; the same seed gives the same run; every milestone is earned by some legal run and
  not earned by a run that falls short; an illegal input is refused with a reason.
- **A guard is real:** break the code a test guards and watch the test fail for that reason, then restore it. A test that cannot fail
  is decoration.
- **Page:** keys, pause (a paused run adds no input and no tick), sound state, and a layout that does not move (compare element boxes
  through a run, as `tests/e2e/tests/tower-stack-layout.spec.ts` does).
- **Honesty:** the page says "Connected" only when the platform answered. It never claims how a milestone is checked: that is the
  manifest's verification field, and the platform decides what players get.

## Before the pull request

- `pnpm repository:check`: files under 300 lines, README present with an Ownership section, no duplicated user-facing sentences.
- `pnpm typecheck`, `pnpm lint`, and the tests for the workspaces you touched.
- The game's integration test submits a finished run once with the platform's run id and seed (`recordingRuns()`) and shows that a
  test-only or practice run submits nothing. The touch test drives the screen with fingers (`attachZones`), not with buttons. On a phone (`hasTouch`), `phone.css` hides the Start and Drop style buttons, so a layout spec that clicks them times out: start a run by
  tapping `#screen` after `restartDelayMs` (from `<sdk>/touch-start`), watch only the controls that have a box (`boundingBox() !== null`; Playwright
  calls a `display: contents` element visible), and see a run end from `#pause` going disabled. Show
  each test can fail: break the line it guards and watch it go red.
- From `apps/web`: `npx vitest run --project unit test/games`. It runs three files: `games-config.unit.test.ts` (the ordered list of
  game ids: add yours), `games-verifiers.unit.test.ts` (the pinned digest) and `games-conformance.unit.test.ts`.
- The conformance test (`apps/web/test/games-conformance.unit.test.ts`) runs over every registered embedded game: the page must be one
  the frame can serve, the script must bundle, the game must tell the platform it is ready, nothing may be refused or thrown, and the
  cover files must exist. It fails if a folder under `games/` is not registered.
- `pnpm test:e2e` for the browser journeys when the change touches how games play. It builds the platform and starts a disposable
  Postgres with Docker, so it is slow and needs Docker; a layout spec for a new game is copied from
  `tests/e2e/tests/tower-stack-layout.spec.ts`. Say in your report if you could not run it.

## Open the pull request

- One branch for the game. Describe what the game is, its milestones and which are replay-verified, what you ran and what each
  command printed, and what you could not check (how it looks and sounds, touch on a real phone, other browsers).
- Never push or deploy for the person unless they ask. They review and merge.
