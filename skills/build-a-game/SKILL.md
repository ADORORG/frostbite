---
name: build-a-game
description: Build a browser game that runs on this platform and get it launched. Use when someone wants to make a game, add a game to the platform, give a game sound, keys, pause or replay-checked milestones, or asks how a game is registered, tested and submitted.
---

# Build a game for the platform

A game here is a small, client-only web page plus one manifest. The platform serves it in a sandboxed frame, remembers the
player's progress for it, and can mint its milestones as tokens. This skill takes you from an idea to a pull request that passes
the platform's checks.

Read the references as you reach each step. Do not read them all first.

## Names you must look up, not guess

The SDK's package name changes if the platform is renamed. Wherever these files write `<sdk>`, use the `name` in the SDK's
`package.json` (in a project that installed it: `node_modules/<sdk>/package.json`; in the platform's repository: `packages/game-sdk`).
Run `<sdk-bin> skill doctor` if you are unsure the skill matches the SDK you have.

## Steps

1. **Understand the rules of the box.** Read `references/platform-rules.md`. A game has no network, no storage, no cookies and no
   outside scripts, and it must stay playable if the platform never answers. Say these limits to the person before designing around
   anything they forbid.
2. **Agree the game with the person.** Ask only what you cannot decide: title, how it is controlled (keyboard, touch, both), how a run
   ends, and 10 to 40 milestones, each one a thing the rules can decide (a score, a count, a time, a clear). A milestone that depends
   on anything the rules cannot see cannot be replay-checked.
3. **Scaffold.** In the platform's repository run `pnpm game:new <id> --title "<Title>"` then `pnpm install`. Outside it, copy
   the structure in `references/game-pattern.md`. Never start from an empty folder.
4. **Write the rules first, apart from the screen.** Pure and seeded: the same seed and inputs always give the same run. No clock,
   no `Math.random`, no I/O. See `references/game-pattern.md` and `references/milestones-and-verification.md`.
5. **Add the screen, sound, keys, pause and a steady layout** with the SDK's pieces, never your own copies. See
   `references/game-pattern.md` and `references/sdk-cheatsheet.md`.
6. **Write the manifest** and the milestones. See `references/milestones-and-verification.md`.
7. **Test, run, check.** See `references/test-and-launch.md`. Do not call the game finished until every command listed there has
   run and you have reported what each printed.
8. **Hand over.** Summarise what was built, what was run and its output, what was not verified (how it looks and sounds, touch on a
   real phone), and the pull request to open. Never push or deploy for the person unless they ask.

## Rules that are never negotiable

- Files stay under 300 lines, tests included. Split by responsibility.
- No `any`, no unchecked type assertions, no non-null `!`. Treat everything from the platform, the player's save and the browser as
  untrusted and validate it.
- Never write a milestone that is not in the manifest, and never change a published milestone: a change is a new version.
- Never claim something works that you did not run. If a command could not run, say so.
- Never put secrets, keys or tokens in a game or its manifest.
- A milestone is "self-reported" unless the platform replays the run. Nothing that carries money or a privilege may depend on a
  self-reported milestone.

## Worked example

`references/worked-example.md` maps every part of a finished game (rules, session, screen, sound, manifest, verifier, tests) to
its file in the platform's repository (`games/bro-maria`), for when the repository is available.
