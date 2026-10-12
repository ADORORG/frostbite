# Legacy game code

Copied from the pre-platform FROST·BITE (`frostbite-game/`, 2026) and kept as it was, so the game plays as it did.
It is **legacy input**, not a conforming module: most files exceed the 300-line limit and the original page
loaded them as scripts. It is exempt from the line policy by path (`tooling/repository-policy/src/files.ts`),
identified here, and may only shrink.

## What was changed from the original

- `alkanes.jsx`: rewritten as simulation only. The live backend (an alkanesjs provider, RPC endpoints and the
  `fetch("/api/run")` call to a house signer) was removed: a platform game is client-only and has no network.
- `app.jsx`: the "Build a cabinet" venue (a submission inbox kept in browser storage), and the bridge that wrote
  to the QUANACADE arcade, were removed; `mark()` also reports the mark to the platform.
- `wallet.jsx`: a notice on every step of the onboarding flow that it is a simulation (it said "connect a wallet"
  and "sign the session" but connects and signs nothing).
- Not copied: the QUANACADE arcade, the admin console, the submission portal, the design-tool standalone page.

## What it relies on from the platform (`src/main.ts`)

`window.React` and `window.ReactDOM` (bundled, React 19), `window.localStorage` (a storage the platform saves
for the three keys in `src/platform/storage-keys.ts`), and `window.FrostbiteHost.milestone`.

## Refactoring plan

Move behaviour out of these files into compliant modules (under `src/`) one area at a time, each with tests,
and delete the legacy file when it is empty: first `telemetry`, `progression` and `alkanes` (pure logic), then
the cabinets (`minigames`, `games9`, `games9b`), then `app.jsx` (1,030 lines of state and layout). Not
scheduled; it is the maintainability backlog for this game.
