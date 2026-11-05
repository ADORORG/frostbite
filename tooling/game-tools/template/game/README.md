# Starter Game (template)

The template `pnpm game:new <id>` copies into `games/<id>`; it is not a game of the platform and is never listed. It uses only `@frostbite/game-sdk/client`; it saves nothing itself and calls no address.

## Layout

- `index.html`: the page. One `<script src="main.js">`, one stylesheet, no inline script.
- `src/game.ts`: the rules, free of the page and the platform, so they can be tested alone.
- `src/main.ts`: the page and the calls to the platform.
- `assets/`: static files, copied as they are.

## Build and play

`pnpm --filter web build` (or `dev`) builds every folder under `/games` into `apps/web/public/play/<id>`, which
is served sandboxed. A game made from this template is listed once its manifest is registered in `configs/games.ts`.

## Adding a game

Copy this folder, register the manifest in `configs/games/`, add one line to `configs/games.ts`, and open a
pull request: every game is reviewed before it is merged.

## Test commands

`pnpm test:unit`, `pnpm test:integration` (bundles the game and runs it against a simulated host),
`pnpm test:coverage`.
