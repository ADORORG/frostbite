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
3. **Scaffold.** In the platform's repository run `pnpm game:new <id> --title "<Title>"` then `pnpm install`. This gives a minimal
   starter (a tap counter with `src/game.ts`), not the finished pattern: delete its `src/game.ts` and test, and build the layers in
   `references/game-pattern.md`, copying the shape of the closest finished game (`references/worked-example.md`). Never start from an
   empty folder. Outside the repository, copy that structure by hand.
4. **Write the rules first, apart from the screen.** Pure and seeded: the same seed and inputs always give the same run. No clock,
   no `Math.random`, no I/O. See `references/game-pattern.md` and `references/milestones-and-verification.md`.
5. **Add the screen, sound, keys, pause and a steady layout** with the SDK's pieces, never your own copies. See
   `references/game-pattern.md` and `references/sdk-cheatsheet.md`. Build for a phone from the first screen, not at the end: import
   `<sdk>/phone.css` and give the page the shared parts, so that on a touch screen the game fills the frame and the page does
   not scroll. See "Phones and notes" below.
6. **Write the manifest** and the milestones. A new game is registered in three places: its manifest `configs/games/<id>.ts`, the
   list in `configs/games.ts` (both done by `game:new`), and the ordered list of ids in `apps/web/test/games-config.unit.test.ts`
   (which `game:new` does not touch: add the id yourself). See `references/milestones-and-verification.md`.
7. **Test, run, check.** See `references/test-and-launch.md`. Do not call the game finished until every command listed there has
   run and you have reported what each printed.
8. **Hand over.** Summarise what was built, what was run and its output, what was not verified (how it looks and sounds, touch on a
   real phone), and the pull request to open. Never push or deploy for the person unless they ask.

## Phones and notes

Most players are on a phone. A game that cannot be played there is not finished, whatever its tests say.

- **The screen is the controller.** On a touch screen the whole frame is the game: readouts are one thin line along the top, and only
  pause and the two sound icons are drawn over the screen. Use `attachZones` (`<sdk>/touch-zones`) for taps, holds and
  slides, and `attachTapToStart` to begin a run. It follows each finger by its own id, so two thumbs work; `fingersOnly` says whether a mouse counts too.
  Do not put a pad of buttons under the screen: enough rows of buttons leave the screen no room to be seen. Keep a button only
  where a gesture cannot do the job, and draw it over the screen.
- **The page never scrolls on touch.** Import `<sdk>/phone.css` and use the shared page parts (`.bar`, the screen, `.foot`
  with `#sound`, `#note` and the buttons). Chapter menus, score lists and cards belong behind a button, not in the page flow.
- **One note, about how to play.** The note under the screen is one short line, and `byInput(keyboardLine, touchLine)` gives a finger
  its own wording (a line that says "Enter" means nothing on a phone). The first screen has `touchLines` too. Never say how a run was
  checked or whether it reached the platform: no seeds, no "claimed", no "not sent". How the game plays is all the player wants.
- **Send the run and say nothing.** At the end of a run call `sendRun(play, runId, record)` (`<sdk>/play`). It drops a failure
  quietly. If a game must say how its milestones are checked, that is a field in the manifest, not words on the screen.
- **Prove it.** Each game's page test checks that a finished run is submitted once, with the run id and seed the platform gave
  (`recordingRuns()` from the test kit's `simulated-game-host`). A test-only or practice run must be shown not to submit.
- **Say what you could not check.** A phone-sized window in desktop DevTools does not switch on touch input: the full-frame touch layout only
  appears with `(pointer: coarse)`. Say plainly that touch on a real phone was not tried unless it was.

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
