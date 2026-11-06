# Tap Counter (`fixture-taps`)

A small tapping game that exists so that tests and the landing page never depend on a real game. Started from the template
(`tooling/game-tools/template`) and kept to its rules: a tap adds one, and 5 and 10 taps are its two milestones (self-reported; it has no
replay verifier and no rewards contract, because nothing that uses it needs them).

It is registered only where the platform is run for development or tests (`developmentGames` in `configs/games.ts`, switched by
`APP_ENV=local|test`), so it is never listed in a deployment players use. A test that needs "a game" uses this one and reads its id, title
and milestones from `configs/games/fixture-taps.ts`, so adding or removing a real game never touches that test.

Do not improve it. A change here changes every test that uses it.

Test commands: `pnpm --filter @game/fixture-taps test:unit`, `test:integration`, `test:coverage`.

## Ownership

Platform engineering.
