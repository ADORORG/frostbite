# SDK-E: the local test page for builders (#50)

Branch `feat/sdk-e-dev-host`, stacked on `feat/g7d-claim-ui`; baseline `ca47555`. Spec: the roadmap's SDK-E (`docs/product/game-sdk-roadmap.md`).
Findings: S58.

## What was built

- `@frostbite/game-sdk/dev-host`: `startDevHost` (`server.ts`), the page and its styles (`page.ts`), the page's behaviour
  (`page-controller.ts`: the real host, the game's sandboxed frame, a panel, a log), the fake platform (`fake-platform.ts`:
  wallet and network, sign-in, claims by press), the browser start (`client.ts`), the game description (`config.ts`), the command
  (`cli.ts` with its process entry `bin.ts`); a `bin` named `frostbite-game-dev`.
- `tooling/game-tools`: `pnpm game:dev <id>` (`dev-game.ts`) over a tested lookup of the registered game (`dev-games.ts`).
- Docs: the SDK README, the builder guide, the roadmap.

## Verification (run on this branch)

- **Tests:** the fake platform; the game description; the server (headers, no path climbing, rebuild on load, a build failure
  shown, concurrent loads, stopping); the page (every control, the log and its limit, the host's refusals, ignoring what is not
  the game's); the browser start; the command and its process entry; and a real-browser spec with the repository's sample game.
  A real `pnpm game:dev sample-game` was run and answered.
- Gates, coverage and the mutation proof are at the end of this file.

## Not done

Failure and slow-answer injection (not chosen); replaying runs or minting on the page (it is not the platform).

## Mutation proof

22 changes to the dev host were tried (path guard, platform headers, method limit, rebuild on load, serialised builds, build-failure
escaping, each claim refusal, claim restart/complete/signing steps, wallet and network events, sign-in event and ids, port and
argument checks, game lookup and optional fields). Three survived the first run: the path guard (no test used enough `..%2f` to
leave the build folder), the escaping of a build error (no test had a message with markup) and a body on HEAD (equivalent: Node
drops it itself, so the special case was removed). Tests were added for the first two; all mutations are now caught.
