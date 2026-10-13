# Game API roadmap (what a game can ask the platform for)

Status: **owner direction of 2026-10-13**. This is the tracking page for the game-facing API. Update the status
column when something ships; every "Built" row names its evidence. The base conversation is
`game-host-interface.md`; this page lists what is added to it.

Owner decision (2026-10-13): a game that declares the `wallet` capability may read the connected wallet's
**address** (and network). The address is public, the game has no network access, and it can only see it when the
player has connected a wallet. This amends section 2 of `game-host-interface.md` ("never the wallet itself"):
an address is now exposed; keys, signatures, wallet objects, transactions and cookies still never are.

## Rules for every addition

1. **Additive only.** A method or event that exists never changes shape. Result schemas are strict in the SDK, so a
   new field in an old result would break every game already built. New abilities are new methods and new events.
2. **Declared, then granted.** A game asks for a sensitive ability in its manifest `capabilities`. A call to an
   ability it did not declare is refused with `permission_denied`. The page's "What it asks for" lists what a game
   declared.
3. **Self-reported stays labelled.** Anything a game reports (milestones, scores) is shown as reported by the
   game. Nothing of value depends on it until a verified level exists (G6).
4. **Rate-limited and size-limited** by typed policy, like saves and unlocks.
5. **Validated in both directions**, and unknown messages are ignored, so an older game is never broken by a
   newer page.

## The list

Status: **Built** (tested), **Decision** (needs the owner), **Not built** (reason given below),
**Blocked** (depends on another task).

| ID     | Ability                                                                                                | Status                | Notes                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK-1a | `wallet.get`: connected wallet address and network, or none                                            | **Built**             | Needs the `wallet` capability in the manifest. The page now mounts the wallet provider on a playable game's page and shows the state in a "Wallet" section of the dock.                           |
| SDK-1b | Display name, avatar, stable player id                                                                 | Decision              | The platform has no player profile. A per-game opaque id derived on the server is simple, but it changes what the account stores. Not built.                                                      |
| SDK-2  | Scores and leaderboards (`scores.submit`, `scores.top`)                                                | Decision              | Needs a server table, boards declared in the manifest, moderation and abuse limits, and the "self-reported" label on the board. Larger than this task; see "Open decisions".                      |
| SDK-3  | Milestone progress (`milestones.progress`) and repeatable claims                                       | Decision              | Needs a target per milestone in the manifest and a place for the count in the account state (a change to the saved shape and its migration). Until then a game keeps its own counter in its save. |
| SDK-4  | Events pushed to the game: `wallet.changed`, `lifecycle.changed` (active/paused), `fullscreen.changed` | **Built**             | Games use `lifecycle.changed` to stop their loop when the tab is hidden or a panel covers them.                                                                                                   |
| SDK-5a | `ui.toast`: show the player a short message                                                            | **Built**             | Plain text only, labelled with the game's name, rate-limited.                                                                                                                                     |
| SDK-5b | `ui.fullscreen.request`                                                                                | Not built             | Browsers require a recent user action; the answer says whether it was allowed.                                                                                                                    |
| SDK-5c | `ui.openLeaderboard`                                                                                   | Blocked               | Waits for SDK-2.                                                                                                                                                                                  |
| SDK-6  | Wallet actions: sign a message, request a transaction                                                  | Blocked               | Waits for G6 (verification) and G7 (minting), and for the wallet-qualification evidence. Signing is still qualification-only. Not exposed to games.                                               |
| SDK-7a | `capabilities.get`: which methods, events and limits this platform supports                            | **Built**             | Lets a game written for a newer platform degrade on an older one.                                                                                                                                 |
| SDK-7b | Reset a save                                                                                           | Done without a method | `progress.save(null)` already clears it and syncs. Documented in the builder guide.                                                                                                               |
| SDK-7c | Versioning rule                                                                                        | Done                  | Rule 1 above. `protocolVersion` changes only for a breaking change; additions are found with `capabilities.get`.                                                                                  |
| SDK-8  | Standalone installable SDK                                                                             | In progress (SDK-D)   | Publish-ready package with a local development host. Publishing itself needs the owner: the package scope, the licence and the registry account.                                                  |
| SDK-9  | SDK explorer game                                                                                      | In progress (SDK-C)   | A development-only game that calls everything and shows what came back, driven by a real-browser test.                                                                                            |

## Owner decisions (2026-10-13, by survey)

- **SDK-1b:** an **opaque per-game player id**, derived on the server from the account, stable across devices once
  signed in. No name or avatar for now. Status: decided, not built (needs a small server change; signed-out
  players need a rule, suggested: a local id that is replaced by the account id on sign-in, told to the game with
  an event).
- **SDK-2:** **global leaderboards, labelled self-reported.** Boards declared in the manifest, shown as "reported
  by the game"; needs a server table, rate limits, moderation and a cap on plausible values. Status: decided, not
  built. Nothing of value may depend on a board.
- **SDK-3:** progress counts live **in the account state, with a migration**: a target per milestone in the
  manifest, and the count synced and merged like saves. Status: decided, not built.
- **SDK-8:** **publish to npm under `@ador`.** Still needed from the owner: confirmation that the `@ador` scope is
  owned, and the licence (the package says `UNLICENSED` until then; no licence is assumed).

Each decided item becomes its own task (SDK-1b, SDK-2, SDK-3, SDK-8 publish) with a plan to be approved before
building, since each changes stored data or a public contract.

## Earlier open questions (answered above)

- **SDK-1b:** is a stable per-game player id wanted, and should it survive signing in (server-derived) or be
  per-browser (random, kept locally)?
- **SDK-2:** global leaderboards or personal bests only? Who may declare a board, and what stops a game posting
  an impossible score? Suggested default: boards declared in the manifest, labelled "reported by the game".
- **SDK-3:** where does a count live (inside the account state)? Suggested default: yes, with the migration.
- **SDK-8:** the npm scope and licence the SDK is published under.

## Not built, and why

- **SDK-5b `ui.fullscreen.request`:** browsers need a recent user action in the page that asks. A message from the
  game's frame is not one, so it was not built on a guess; it needs a spike in several real browsers first.
  Players already have the platform's Full screen button, and the game is told with `fullscreen.changed`.
- **SDK-E (new): a local development host for builders** (a page that frames their game, lends a fake wallet and
  fires events), so a builder outside this repository can run a game before a pull request. The installable package
  is the first half of that.
- **Wallet in a real browser:** the wallet library is tested here through its reported state only. Connecting a real
  wallet, returning from the connection page and seeing the address in a game needs a physical wallet and is not
  evidenced yet.

## Evidence (2026-10-13)

Task record `references/game-sdk-api-task-record.md`. Gates: format, lint (45 tasks and the repository policy),
typecheck; coverage for game-sdk, feature-games, test-kit and sdk-explorer above threshold; 19 mutants of the new
guards, all killed; full e2e run with the explorer's own spec; the packed SDK installed in an empty project,
type-checked and run.
