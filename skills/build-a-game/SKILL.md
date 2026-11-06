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

The SDK's package name changes if the platform is renamed. Wherever these files write `<sdk>` (as in `<sdk>/run-record`), write the
SDK's real package name in your code. Find it in the `sdk` field of `.installed.json`, beside this file, or in the SDK's own
`package.json` (in a project that installed it: `node_modules/<sdk>/package.json`; in the platform's repository:
`packages/game-sdk`). The same goes for the test kit and the package scope of a game (copy a sibling game's `package.json`).
To check this skill matches the SDK you have, run the SDK's skill command (the entry in its `package.json` `bin` that ends in
`-skill`) with `doctor`.

## Steps

1. **Understand the rules of the box.** Read `references/platform-rules.md`. A game has no network, no storage, no cookies and no
   outside scripts, and it must stay playable if the platform never answers. Say these limits to the person before designing around
   anything they forbid.
2. **Agree the game with the person.** Ask only what you cannot decide: title, how it is controlled (keyboard, touch, both), how a run
   ends, and 10 to 40 milestones, each one a thing the rules can decide (a score, a count, a time, a clear). A milestone that depends
   on anything the rules cannot see cannot be replay-checked. Two milestones must never be earned by the same event (for example "300
   metres" and "top speed", when top speed is reached at 300 metres): list the tick each is first earned on the sample run and check
   they differ in meaning, not only in name.
   If nobody can be asked, choose sensible defaults, write the title, summary and milestone list down as a **draft for the owner to
   approve**, and say so in the manifest comment and in your report. The owner approves a game's words and milestones; you do not.
3. **Scaffold.** In the platform's repository run `pnpm game:new <id> --title "<Title>"` then `pnpm install`. This gives a small
   finished game in the pattern of `references/game-pattern.md`: seeded rules (`src/rules/`), a session that records the run
   (`src/session.ts`), the screen, the two cards (`src/guide.ts`, `src/screen/result.ts`), sound, keys, pause, a replay verifier
   (`src/replay.ts`) and the tests that prove them, already registered and passing. Replace the rules first, then the drawing, the
   words and the milestones; keep the layers and the wiring in `src/main.ts`. Never start from an empty folder. Outside the
   repository, copy that structure by hand (`references/worked-example.md`).
4. **Write the rules first, apart from the screen.** Pure and seeded: the same seed and inputs always give the same run. No clock,
   no `Math.random`, no I/O. See `references/game-pattern.md` and `references/milestones-and-verification.md`.
5. **Add the screen, sound, keys, pause and a steady layout** with the SDK's pieces, never your own copies. See
   `references/game-pattern.md` and `references/sdk-cheatsheet.md`. Build for a phone from the first screen, not at the end: see
   "Phones and notes" below.
6. **Write the manifest** and the milestones. A new game is registered in two places, both written by `game:new`: its manifest
   `configs/games/<id>.ts` and the list in `configs/games.ts`. No test needs its id added; the conformance test fails if a folder
   under `games/` is not registered. See `references/milestones-and-verification.md`.
7. **Test, run, check.** See `references/test-and-launch.md`. Do not call the game finished until every command listed there has
   run and you have reported what each printed.
8. **Hand over.** Summarise what was built, what was run and its output, what was not verified (how it looks and sounds, touch on a
   real phone), and the pull request to open. Never push or deploy for the person unless they ask.

## Phones and notes

Players open games on phones. A game that cannot be played there is not finished, whatever its tests say. These are the rules; the
pieces to use and the files to copy are in `references/game-pattern.md` ("Touch", "Page skeleton").

- **The screen is the controller.** On a touch screen the whole frame is the game: the readouts are one thin line along the top, pause and
  the two sound icons sit in the top right corner, and the note shows at the foot (only while it has words). Fingers play the game
  directly. Do not put a pad of buttons under the screen: enough rows of buttons leave the screen no room to be seen. A game that needs a few
  extra buttons (fire, a special move) uses `attachTouchButtons` (`<sdk>/touch-buttons`): one to four, in the bottom right corner over the
  screen. A game with more actions cycles them with one of the four or gives them keys.
- **The page never scrolls on touch.** Import `<sdk>/phone.css` and give the page the parts it lays out. Chapter menus, score lists and
  cards belong behind a button, not in the page flow.
- **One note, about how to play.** One short line, worded for a finger as well as for a keyboard. Never say how a run was checked or
  whether it was sent: no seeds, no "claimed", no "not sent". How the game plays is all the player wants. If a game must
  say how its milestones are checked, that is a field in the manifest, not words on the screen.
- **Send the run and say nothing.** At the end of a run call `sendRun(play, runId, record)` (`<sdk>/play`).
- **Prove it.** The game's integration test must show that a finished run is submitted once and that a test-only or practice run is
  not (`references/test-and-launch.md`).
- **Say what you could not check.** Resizing a desktop window does not switch on touch input, but the browser's device mode (a phone
  profile in DevTools) does, so use it to see the touch layout (`(pointer: coarse)`) and the whole-screen controls. How it feels under a
  thumb, and on the phone's own browser, only a real phone shows: say plainly that you did not try one unless you did.

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
