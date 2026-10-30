# SDK Explorer

A development-only game that calls every method of the platform's SDK and shows what came back, so a builder
can see each answer (and each refusal) in the real isolated frame. It also lists the events the platform sends
the game on its own: the wallet connecting, the tab being hidden, full screen starting.

It declares the `wallet` capability so `wallet.get` can be seen answering; without a connected wallet the answer
is `null`. `wallet.connect` asks the platform to open its wallet chooser (the outcome arrives as `wallet.changed`). The game keeps one counter in its save (`progress.save`) and declares one milestone, `first-call`,
earned by `milestones.unlock`.

It declares `run:submit` so `run.start` and `run.submit` can be seen answering. It publishes no replay rules, so the platform
answers `run.start` with `not-supported` (or `signed-out`), and `run.submit` is shown refusing a run that was never issued.

It is registered only where the platform runs for development or tests (`configs/games.ts`).

`src/probes.ts` is the list of calls and how a result is described; `src/main.ts` is the page.

Test commands: `pnpm --filter @game/sdk-explorer test:unit`, `test:integration`, `test:coverage`.

## Ownership

Platform games team.
