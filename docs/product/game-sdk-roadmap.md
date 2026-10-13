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

| ID     | Ability                                                                                                | Status                | Notes                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK-1a | `wallet.get`: connected wallet address and network, or none                                            | **Built**             | Needs the `wallet` capability in the manifest. The page now mounts the wallet provider on a playable game's page and shows the state in a "Wallet" section of the dock.                                             |
| SDK-1b | `player.identity()` and `player.changed`: an opaque per-game player id                                 | **Built**             | Random id per player and game, kept on the server with the save row (migration `game_player_id`); this browser's random id until sign-in. Needs no capability: it identifies nobody. Name and avatar are not built. |
| SDK-2  | Scores and leaderboards (`scores.submit`, `scores.top`)                                                | Decision              | Needs a server table, boards declared in the manifest, moderation and abuse limits, and the "self-reported" label on the board. Larger than this task; see "Open decisions".                                        |
| SDK-3  | Milestone progress (`milestones.progress`) and repeatable claims                                       | Decision              | Needs a target per milestone in the manifest and a place for the count in the account state (a change to the saved shape and its migration). Until then a game keeps its own counter in its save.                   |
| SDK-4  | Events pushed to the game: `wallet.changed`, `lifecycle.changed` (active/paused), `fullscreen.changed` | **Built**             | Games use `lifecycle.changed` to stop their loop when the tab is hidden or a panel covers them.                                                                                                                     |
| SDK-5a | `ui.toast`: show the player a short message                                                            | **Built**             | Plain text only, labelled with the game's name, rate-limited.                                                                                                                                                       |
| SDK-5b | `ui.fullscreen.request`                                                                                | Not built             | Browsers require a recent user action; the answer says whether it was allowed.                                                                                                                                      |
| SDK-5c | `ui.openLeaderboard`                                                                                   | Blocked               | Waits for SDK-2.                                                                                                                                                                                                    |
| SDK-6  | Wallet actions: sign a message, request a transaction                                                  | Blocked               | Waits for G6 (verification) and G7 (minting), and for the wallet-qualification evidence. Signing is still qualification-only. Not exposed to games.                                                                 |
| SDK-7a | `capabilities.get`: which methods, events and limits this platform supports                            | **Built**             | Lets a game written for a newer platform degrade on an older one.                                                                                                                                                   |
| SDK-7b | Reset a save                                                                                           | Done without a method | `progress.save(null)` already clears it and syncs. Documented in the builder guide.                                                                                                                                 |
| SDK-7c | Versioning rule                                                                                        | Done                  | Rule 1 above. `protocolVersion` changes only for a breaking change; additions are found with `capabilities.get`.                                                                                                    |
| SDK-8  | Standalone installable SDK                                                                             | In progress (SDK-D)   | Publish-ready package with a local development host. Publishing itself needs the owner: the package scope, the licence and the registry account.                                                                    |
| SDK-9  | SDK explorer game                                                                                      | In progress (SDK-C)   | A development-only game that calls everything and shows what came back, driven by a real-browser test.                                                                                                              |

## Owner decisions (2026-10-13, by survey)

- **SDK-1b:** an **opaque per-game player id**, derived on the server from the account, stable across devices once
  signed in. No name or avatar for now. Status: **built** (see the table).
- **SDK-2:** **global leaderboards, labelled self-reported.** Boards declared in the manifest, shown as "reported
  by the game"; needs a server table, rate limits, moderation and a cap on plausible values. Status: decided, not
  built. Nothing of value may depend on a board.
- **SDK-3:** progress counts live **in the account state, with a migration**: a target per milestone in the
  manifest, and the count synced and merged like saves. Status: decided, not built.
- **SDK-8:** **publish to npm under `@ador`.** Still needed from the owner: confirmation that the `@ador` scope is
  owned, and the licence (the package says `UNLICENSED` until then; no licence is assumed).

### Follow-up decisions (2026-10-13, second survey)

- **Signed-out id (SDK-1b):** a **local id replaced on sign-in**. The browser keeps a random id; on sign-in it
  becomes the account's id and the game is told with the `player.changed` event (built). Games
  must handle the change; the SDK guide will say so.
- **Who may post (SDK-2):** **signed-in players only**, one best entry per player per board. Signed-out players can
  play but not post.
- **Abuse limits (SDK-2):** a **minimum and maximum per board in the manifest** (out-of-range posts refused), a
  **rate limit per player per board** (typed policy value), and **staff can hide or remove an entry**, with an audit
  record. A report button was not chosen.
- **Board shape (SDK-2):** **daily, weekly and all-time tabs** (chosen over the suggested top-100 all-time). Needs
  time-window queries and resets: window boundaries (UTC), what happens to an entry hidden by staff in a past
  window, and the page size per tab are to be fixed in the plan.

### Third survey (2026-10-13)

- **SDK-3 repeatable milestones:** **count each earning**; the total is shown, and a later minting step may claim
  per count. Once-only milestones stay once.
- **SDK-E builder tool:** **a command that opens a local test page** (runs the game in the same sandbox, fake
  wallet, platform event buttons, a log of every call). Filed as task #50.
- **Wallet connection (SDK-F, new):** the connect modal should be **callable from any screen**, not only
  `/connect`, and a game should ask the platform to open it **through the API** (`wallet.connect()`); the game never
  handles the wallet itself. Placement to be asked again after the real-wallet test. Filed as task #55.
- **Order:** build the **player id (SDK-1b) first**; SDK-3 (#53), SDK-2 (#54), SDK-E (#50) and SDK-F (#55) are filed.
- **CSP (#56):** the owner wants an enforced-policy test before deciding anything; the policy is not weakened.

- **Wallet widget (SDK-F, extended):** `/connect` becomes unnecessary. The app shell gets a fully featured wallet
  widget (avatar, connected wallet, balance, address) that opens the connect modal when nothing is connected;
  games open the same modal through `wallet.connect()`. Open for its plan: where a balance comes from, where an
  avatar comes from (no profile exists), and what happens to the wallet-qualification page. Task #55.

### Wallet widget survey (2026-10-13)

- **Balance:** from the **chain indexer through our server**, with loading, stale and error states shown honestly.
- **Avatar:** **generated from the address** (deterministic, no profile or upload).
- **Menu when connected:** address with a copy button, balance with refresh, switch wallet / disconnect. (A link to
  the player's games and milestones was not chosen.)
- **`/connect`:** the owner said the app is **not public and has no live deployment**, so `/connect` **can simply be
  removed**, and the app should be treated as **fresh, expecting a lot of modification and reshaping** (no
  compatibility or redirect burden). Still to confirm in the plan: what happens to the wallet-qualification tooling
  (physical-wallet evidence, W2-10B) once its page goes: keep it as a staff-only route, or remove it with the page.

### Fourth survey (2026-10-13)

- **Wallet-qualification tooling:** **removed now with `/connect`, rebuilt when needed.** The evidence records stay
  in the docs; the page, its operations and its table go (the plan lists exactly what, and what the evidence
  records referring to them become).
- **Leaderboard boards (SDK-2):** declared **in the manifest** with id, title, order, minimum and maximum, reviewed
  by pull request like milestones. No runtime boards.
- **Leaderboard entries (SDK-2):** rank, score and date, always with the "reported by the game" label; the
  entry's identity is the **generated avatar and shortened wallet address**, falling back to the **opaque player
  id** ("Player 7f3a") when the player has no wallet known to the platform. To settle in the plan: where the
  server learns a signed-in player's wallet address (the account's linked wallet, if any), and that a public board
  links an address to scores (addresses are public; the player should be told before posting).
- **Milestone progress UI (SDK-3):** a **toast plus the count in the dock** ("First win reached (x3)").

### Fifth survey (2026-10-13)

- **Windows (SDK-2):** **UTC, weeks start Monday**; the board says when it resets (00:00 UTC).
- **Page size (SDK-2):** **top 50 plus the player's own rank**, per tab.
- **Hidden entries (SDK-2):** hidden **everywhere** (daily, weekly, all-time) and **ranks recomputed**; the audit
  record keeps who hid it and why. No replacement by a next-best score.
- **Builder test tool (SDK-E):** a fake connected wallet with network switching, a signed-out / signed-in switch (shows the
  local id becoming the account id and `player.changed`), and tab-hidden / full-screen event buttons. Failure and
  slow-answer injection was not chosen.

### Sixth survey (2026-10-13)

- **Progress reporting (SDK-3):** the game sends the **current total** (`milestones.progress(id, current)`); the
  platform keeps the highest value and unlocks the milestone at its target. Idempotent, so a retried message cannot
  double count.
- **Repeatable earnings (SDK-3):** the game calls **`milestones.unlock` again** and the platform counts it for a
  repeatable milestone (rate limited). To settle in the plan: the call currently answers `already-unlocked`, so its
  result needs a count without changing the existing shape (an additive field breaks strict old clients, so likely
  a new `milestones.earn` result or a separate count read; the count is also readable in `milestones.list` through
  a new method).
- **Cap (SDK-3):** the **manifest sets a maximum per milestone** (reviewed by pull request); counts above it are
  ignored.
- **Licence (SDK-8):** **MIT.** Still needed: the copyright holder's name for the LICENSE file, and confirmation
  that the `@ador` npm scope is owned. The package stays private until both are given.

### Seventh survey (2026-10-13)

- **Publisher (SDK-8):** the owner owns the GitHub organisation **ADORORG** (`github.com/ADORORG`). That is not the
  npm scope: whether `@ador` exists and is owned on npm is **not confirmed**, and the licence holder name has not
  been stated exactly (ADORORG is the likely name). Both to confirm before the package is published.
- **Verified milestones (G6):** **verified milestones unlock leaderboard entries**, read as: only replay-verified
  runs appear on boards. **This conflicts with the earlier decision** (global boards labelled self-reported) and
  makes boards depend on G6, which also makes every board game deterministic. To be resolved in the next survey:
  self-reported boards first and a verified tier later, or no boards until G6.
- **First verified game (G6):** **FROST·BITE**, which needs its board generation made deterministic (seeded).
- **Build order:** **milestone progress (SDK-3), then the wallet widget (SDK-F), then leaderboards (SDK-2).**

### Eighth survey (2026-10-13)

- **Leaderboards (SDK-2): verified-only boards, so no boards until G6.** This settles the earlier conflict in
  favour of verification: boards accept only replay-verified runs, every board game must be deterministic, and
  SDK-2 (#54) now waits for G6 (#41). The self-reported board design above stays as the display design; only the
  admission rule changes. Build order becomes: SDK-F wallet widget, then G6, then SDK-2.
- **npm (SDK-8):** publish under a **scope that matches the GitHub organisation (e.g. `@adororg`)**, holder
  **ADORORG**, licence **MIT**. The workspace package is named `@ador/game-sdk`; publishing under another scope
  means a rename (workspace-wide) or a published name that differs from the workspace name. Decide at publish time;
  the scope must also be created on npm by the owner.
- **Wallet providers (SDK-F):** keep the **current 13 candidates**, detected wallets first.
- **Network mismatch (SDK-F):** a **warning badge with the expected network** ("Mainnet - this game uses signet"),
  the player may continue.

### Ninth survey (2026-10-13)

- **Placement (SDK-F):** top-right of the header on every page, replacing the Connect link; avatar and short
  address when connected.
- **Balance (SDK-F):** BTC balance in sats and BTC with a last-updated time, refreshed every 60 seconds only while the
  menu is open, plus a manual refresh. Token balances and pending amounts were not chosen.
- **Reconnect (SDK-F):** reconnect automatically to the last wallet; the player can disconnect to forget it.
- **Sign-in (SDK-F): sign-in only through the widget, never elsewhere.** This makes the widget the single sign-in
  entry point and so **needs wallet message signing to be qualified**, which the physical evidence (W2-10B) has not
  done; the repository today says a wallet connection is not authentication and sign-in is disabled until that
  evidence passes. It also touches every other sign-in path in the app (passkey sign-in and linking, the
  development sign-in picker, the e2e sign-in fixtures). To settle before the plan: what happens to those paths, and
  what the widget does while wallet sign-in is not qualified (connect without signing in, with the sign-in step shown
  as unavailable).

### Tenth survey (2026-10-13): sign-in through the widget

- **Interim behaviour:** the owner says the **wallets are already tested working**, so the widget goes straight to
  **connect, then sign in and create a session cleanly** (the server side, BIP-322 challenge, verification and
  sessions, was completed earlier). The ledger still lists W2-10B (exact-version physical evidence) as blocked: the
  owner's statement is recorded here, and the evidence record should be written into the repository so that row can
  be closed honestly.
- **Adapter pattern:** sign-in is a set of adapters: **wallet now, email later** (for non-web3 users), and a player
  can **link a wallet or an email** to one account.
- **Several wallets per account:** **allowed**: a player can link more than one wallet, each proven by its own
  signature; switching wallets does not create a new account.
- **Passkeys:** kept as a **secondary** way to sign in, added from the widget menu.
- **Test sign-in:** a **test-only sign-in route**, disabled outside tests and development, replaces the development
  picker and the browser-test sign-in; it is not shown in the widget.
- **Consequences for the plan:** an identity-adapter port with a wallet adapter; a link flow and proof per wallet and a
  rule for the last remaining method (as for passkeys today); session rotation on link and unlink; the widget menu
  lists linked wallets and the account's sign-in methods; the email adapter is designed for but not built.

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
