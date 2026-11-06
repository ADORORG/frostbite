# Onboarding a game

Status: ADR-018 Amendment 1 (client-only games) is accepted. This describes what works today (2026-10-12): the manifest, the catalog and game page, the client-only host
(isolated frame, SDK, local and account saving, milestones as self-reported). Minting and the replay-verified level
do **not** exist yet; the last section says what each needs.
The template is `tooling/game-tools/template` (a small finished game: rules, session, screen, cards, sound, keys, pause, a replay verifier and their tests). Start from it with `pnpm game:new`; do not start from nothing.

A coding agent can do the steps below for you: see `docs/product/build-a-game-with-an-agent.md` for the skill and how to install it.

## What a game is

A game is a folder of reviewed source plus one manifest:

- **Client-only.** No server, no `fetch`, no browser storage, no cookies, no CDN scripts or fonts. Everything
  the game needs is bundled with it. It asks the platform page around it to remember things.
- **Built by the platform.** A pull request adds source; CI builds it into static files served under the
  platform's own domain at `/play/<id>/index.html`, in a frame the browser cuts off (below). No binary is
  committed. Every game is reviewed before it is merged.
- **Described by a manifest** (`defineGame`, `@frostbite/shared/games`): who it is, its version, the chain its
  future on-chain actions use, and the milestones it can report. A manifest that fails its checks stops the
  platform starting, so a mistake shows at once.

## Add a game in four steps

1. **Run `pnpm game:new <id> [--title "My Game"]`, then `pnpm install`.** It copies `tooling/game-tools/template/game` to
   `games/<id>` (package `@game/<id>`), writes `configs/games/<id>.ts` and adds the game's import and list entry
   to `configs/games.ts`, above the `game:new` markers. `<id>` is lower-case words joined by hyphens; it is the
   page address and every record's key. The new game already passes the conformance check and the verifier pin. (By hand: copy the
   folder, rename the package, write the manifest, add the two registry lines.)
2. **Write the game** in `src/` (see "What the folder holds").
3. **Edit the manifest** in `configs/games/<id>.ts`: `launch: { mode: "embedded" }`, and the milestones, whose ids
   must be ones the game's code unlocks. When the rules change, `apps/web/test/games-verifiers.unit.test.ts` prints the digest to pin in the manifest. Nothing else in the platform is edited.
4. **Open a pull request.** The checks in "Checks every game passes" must pass.

```ts
import { defineGame } from "@frostbite/shared/games";

export const myGame = defineGame({
  schemaVersion: 1, // the manifest format
  id: "my-game",
  title: "My game",
  summary: "One sentence for the list.",
  tags: ["arcade"], // one to four kinds from the platform's list (`gameTags` in `@frostbite/shared/games`); the games page searches and filters by them
  description: "A longer text for the game's page.",
  version: "0.1.0", // the game's own release; a change to a milestone is a new version, never an edit
  network: "bip122:00000008819873e925422c1ff0f99f7c", // must be a chain the platform is configured for
  launch: { mode: "embedded" }, // played in the platform's frame; no address to set
  capabilities: [], // what the game asks to see; add "wallet" to receive the player's wallet address (see below)
  milestones: [
    {
      id: "first-level", // unique within the game
      title: "First level",
      description: "You finished the first level.",
      criteria: "Finish level 1.", // shown to players: how it is earned
      claimPolicy: "once", // "once" per player, or "repeatable"
      // target: 10, // optional, "once" only: the game reports a running total and the milestone is earned at 10
      // maxCount: 100, // required for "repeatable": each report is counted, up to this many
    },
  ],
});
```

## What the folder holds

| Path          | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `index.html`  | The page: one `<script src="main.js">`, one stylesheet. No inline script, handler, frame or form.  |
| `styles.css`  | The only stylesheet.                                                                               |
| `assets/`     | Static files, copied as they are. Name them relative to the page (`assets/a.png`), never `/a.png`. |
| `src/game.ts` | The rules, free of the page and the platform, so they are testable alone.                          |
| `src/main.ts` | Draws and calls the platform through `@frostbite/game-sdk/client`. The bundle entry.               |
| `test/`       | Unit tests for the rules, and an integration test that bundles the game and runs it (below).       |

Only `index.html`, `styles.css`, `assets/` and the bundled `main.js` are published; tests and config never leave
the folder. `checkGameHtml` refuses a page that loads from another address, has an inline script or handler, or
embeds a frame, form or object, and says which, when the game is built.

## A cover for the list

A game may declare a cover, which the games list shows as its preview: `cover: { alt, image, video }` in the manifest.
`image` is the file name of a picture in the game's `assets/` folder (`avif`, `jpg`, `png`, `svg` or `webp`), `alt`
says what it shows, and `video` is a short silent clip (`mp4` or `webm`) in the same folder, or `null`. The picture
is always shown; the clip plays over it, muted and looping, only when the visitor has not asked for less motion, and
falls back to the picture if it cannot play. Names are file names only (no folder, no address), so a cover always
comes from the platform's own address, and only a game the platform plays itself may have one. A game with no cover
gets a moving scene as its picture (never initials), and a game with a picture but no clip gets a scene laid over the
picture. Conformance fails if a named file is missing from `assets/`. Use 16:9; the list crops to fit.

To choose which scene the card shows, name it: `scene: "runner"`. Left out, the platform picks one from the game's id, so
the card looks the same on every visit. The platform checks the name against the scenes it has (`@frostbite/scenes/library`) and
refuses to start with a game that names one it does not have, rather than ignoring it.

## Pieces to build on

A game that plays on a seed and wants its milestones replay-checked can build on small modules of the SDK instead of writing its
own: `@frostbite/game-sdk/seeded` (the seeded generator every rule must use), `@frostbite/game-sdk/run-inputs` (checking a run input's fields
and tick, and refusing with a reason), `@frostbite/game-sdk/cabinet-runs` (how a cabinet reaches the platform's runs); a finished run is sent with `sendRun` from `@frostbite/game-sdk/play`, which says nothing to the player (how a run is checked is not part of playing), and
`@frostbite/game-sdk/play` (reporting a milestone only if the manifest declares it, and starting and submitting runs). A pixel-art screen on a canvas also has `@frostbite/game-sdk/pixels` (`block`, `sprite`, `wrap`) and
`@frostbite/game-sdk/fixed-step` (whole ticks from elapsed time, at the game's own rate). Frost Runner, Icicle Drop and Tower Stacker
(`games/frost-runner`, `games/icicle-drop`, `games/tower-stack`) are three complete examples: pure seeded rules, a session that records the
choices, a verifier with a sample run, and a manifest that pins its digest.

### Sound, keys, pause and a steady layout

Every game on the platform behaves the same way, and the SDK has the pieces so a game does not write them again:

- **Sound** (`@frostbite/game-sdk/audio`): music and effects are data (a `Track` of looping note voices, an `Effect` of gliding tones or noise) that the
  SDK plays with the browser's audio, so there are no sound files. `setUpSound` (`@frostbite/game-sdk/audio/setup`) makes the sound, puts the player's
  panel in a place the game gives it (bottom left of the foot, never floating over the game), silences a paused game and a hidden tab, and hands
  back `sfx(name)`, `play(effect)`, `music(on)` and `tempo(scale)`. Import `@frostbite/game-sdk/audio/panel.css` in the game's stylesheet. A browser
  keeps a page silent until the player has pressed something, so the panel says "Sound starts when you press a key" until then, and says so when
  the browser has no audio. The frame has no storage, so the game keeps `SoundSettings` beside its own progress and reads it back with
  `parseSound`; it is saved whenever the player changes it.
- **Keys** (`@frostbite/game-sdk/controls`): `attachKeys(window, keys, on)` with `standardKeys` gives Enter (and the numpad Enter) as `start` and P as
  `pause`; a game adds its own and may take Space for pause only if Space is not its main action. Held keys do not repeat, Ctrl/Alt/Meta shortcuts
  and typing in a field are left to the browser. Enter must never throw away a run that is going.
- **Pause and the loop** (`@frostbite/game-sdk/pause`, `@frostbite/game-sdk/run-loop`): `createPause` is the one place the screen, the sound and the clock agree
  on whether the game is paused; `createRunLoop` runs a real-time game in whole ticks, asks for one animation frame at a time, stops the clock on a
  pause (the time paused is not counted), pauses a hidden tab, and refuses a second start while one is going. Pausing adds no input and no tick, so a
  paused run replays like any other.
- **A layout that does not move**: nothing under the player's thumb may move during a run. A button that is not offered keeps its place
  (`visibility`, not `display: none`), buttons have a fixed minimum width so a changing label does not shift their neighbours, and the note, the
  earned list and the score row have heights that never grow. `tests/e2e/tests/game-contract.spec.ts` compares the boxes of the controls and the screen when a run starts and in its
  first seconds, for every game under `games/`; nothing is copied for a new game.
- **Tests without a speaker** (`@frostbite/game-sdk/audio/fake`): `installFakeAudio(window)` stands in for the browser's audio and notes every tone, so a
  test can check that a game made a sound, stopped its music, or stayed quiet while paused.

Games on the SDK: Frost Runner, Icicle Drop, Tower Stacker, Bro Maria and Snowball Dash use all of it.

## Talking to the platform

```ts
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";

const client = createGameClient();
await client.ready(); // first; the platform answers with the player's state
const saved = await client.progress.load(); // JSON or null
await client.progress.save({ score: 12 }); // JSON; at most 64 KB, batch to about one a second
const list = await client.milestones.list(); // declared milestones with the player's status
await client.milestones.unlock("first-level"); // idempotent; only declared ids
const { signedIn, walletConnected } = await client.player.info(); // yes/no only
const wallet = await client.wallet.get(); // { address, network } or null; needs the "wallet" capability
await client.ui.toast("Level up!"); // a short message the page shows, under the game's name
const supported = await client.capabilities.get(); // methods, events, limits, what this game was granted
const stop = client.on("lifecycle.changed", ({ state }) => {
  /* "paused" when the tab is hidden: stop the loop; "active" when it is back */
});
```

- Every failure is a `GameHostError` with a stable code (`invalid_request`, `not_ready`, `rate_limited`,
  `too_large`, `unavailable`, `unknown_method`, `unknown_milestone`, `permission_denied`). A call the platform does not answer in
  ten seconds ends with `unavailable`; the game must still be playable.
- Limits are platform policy, not game code: 64 KB of saved state, 60 saves and 60 unlocks a minute. Over a limit the
  call is refused.
- Save and load **plain JSON of your own making**, versioned by you: a save written by an older release must
  still load. Treat what `progress.load()` returns as untrusted input; `restore()` in `game.ts` shows how.
- Do not wait on the platform to start drawing; do not call `unlock` for a milestone not in the manifest.

## The wallet, the events and the other calls

The full list, with the status of what is still to come, is `docs/product/game-sdk-roadmap.md`.

- **`wallet.get()`** returns the connected wallet's **public address and network name**, or `null` when none is
  connected. Declare `capabilities: ["wallet"]` in the manifest; without it the call is refused with
  `permission_denied`, and the page's "What it asks for" shows the request. The game cannot see a key, sign
  anything or move anything: the address is all it receives. The player connects a wallet with the wallet
  button in the platform's header (on every page); the game's page has a "Wallet" section that says what the game
  can see.
- **`wallet.connect()`** asks the platform to open that wallet chooser, for a game that wants a wallet. It needs the
  same `wallet` capability and resolves to `requested` (the player now chooses), `already-connected` or
  `unavailable` (this page cannot offer a chooser). The game never handles the wallet: when the player connects it
  receives the `wallet.changed` event, and a player who closes the chooser changes nothing. At most six asks a
  minute.
- **`milestones.claim(id)`** asks the platform to start a claim of a milestone the player earned, to be signed with their
  own wallet in the platform's page; the game never sees a wallet, a signature or a transaction. It needs the
  `milestone:claim` capability (which needs `rewards` in the manifest) and resolves to `requested` (asking again changes
  nothing; watch `claim.changed`) or `unavailable` with why: `signed-out`, `no-wallet`, `not-earned`, `not-claimable`,
  `limit-reached`, `wrong-network`, `unavailable` or `not-supported` (this platform cannot take claims for this game, which
  is every game today: nothing is deployed to claim from). `claim.changed` carries the milestone id and one of
  `awaiting-signature`, `pending`, `claimed`, `complete`, `failed`, `expired`; **`complete` only once the chain's indexed state
  agrees**, never on confirmation alone. At most six asks a minute. The player sees the claim in the platform's own review over the game (what it does, the network fee they pay, and where it stands); the game only learns how it goes.
- **Events** arrive without a request, through `client.on(name, handler)`, which returns a function that stops
  listening: `wallet.changed` (only for a game that declared `wallet`), `claim.changed` (only for `milestone:claim`), `lifecycle.changed` (`paused` while the tab
  is hidden, `active` when it returns) and `fullscreen.changed`. A game should stop its loop on `paused`. A key the player presses before clicking into the game arrives as `key.forwarded`; the SDK plays it back as a normal `keydown`/`keyup` on `window`, so a game that listens with `attachKeys` (or its own `window` listener) hears it with no extra code.
- **`ui.toast(message)`** asks the page to show up to 140 characters of plain text; the page prefixes the game's
  name so it cannot pass for the platform's. It resolves to whether it was shown. At most six a minute.
- **`capabilities.get()`** lists the methods and events this platform knows, the limits, and what the game was
  granted. A game written for a newer platform should ask first and do without what is missing.
- **`player.identity()`** returns `{ id, kind }`: an opaque id for this player **in this game only** (another game
  is given a different one). `kind: "local"` is a random id kept in this browser; once the player signs in it
  becomes `kind: "account"`, the same on every device, and the game is told with the `player.changed` event.
  The id is random and says nothing about the person (no name, no account, no wallet), so it needs no capability.
  **The id can change once**, from local to account: keep what you key by it in your own save, or re-key when
  `player.changed` arrives. A signed-in player's game starts with the account's id (the answer waits for the
  account's first reply). `player.changed` may repeat the id you already have; compare before acting.
- **Progress toward a target.** Declare `target: 10` on a milestone earned once and report the running total with
  `client.milestones.progress("ten-wins", wins)`: send the **total, not the change**. The platform keeps the larger
  of your report and what it holds, never above the target, so a repeated or late report cannot count twice, and it
  earns the milestone when the total reaches the target (do not call `unlock` for it: that is refused). The answer
  says the total held, the target and whether it is earned. At most 120 reports a minute.
- **Repeatable milestones.** Declare `claimPolicy: "repeatable"` with a `maxCount`. Each `milestones.unlock` call
  after the first is counted, up to `maxCount`, and ignored after; the call still answers `already-unlocked`, so
  read the count with `client.milestones.counts()`, which gives for every milestone `{ count, current, target,
max }`. The page shows the count ("Reached x3") and announces each counting. Counts merge by the larger side, so
  two devices that each earned it while offline are counted once between them.
- **Reset a save** with `progress.save(null)`; there is no separate call.
- **Compatibility rule:** a method or event that exists never changes shape. New abilities are new methods and
  events, so a game built on an older SDK keeps working on a newer platform.
- Try every call, in the real frame, with the SDK explorer (`games/sdk-explorer`, listed where the platform runs for
  development or tests).

## Where the player's progress lives

- **Signed out:** the platform page keeps it in the browser, under keys for this game only. The game never sees
  the storage.
- **Signed in:** the page also syncs it with the player's account (merged when a second browser
  opens the game: the newest save wins, and every milestone from either side is kept with its earliest time). The
  page tells the player which of the two is true.
- A game does nothing for either: it only calls `progress.save` and `milestones.unlock`.

## What the browser enforces

The frame is `sandbox="allow-scripts"`, and the files are served with `Content-Security-Policy: sandbox
allow-scripts; connect-src 'none'; script-src 'self'; style-src 'self'; frame-src 'none'; form-action 'none'`
and related headers. So a game has no cookies, no storage, no network and no way to read the platform page.
Allowed: full-screen (the game's page also has a Full screen button of the platform's, which takes the frame full screen where the browser allows it; Esc leaves), sound and keyboard or gamepad input; not camera, microphone, location or files.
Sample game's "Run safety probe" button demonstrates this and is checked in a real browser by
`tests/e2e/tests/game-host.spec.ts`.

## Making milestones claimable on chain (declaration only so far)

A game that wants its milestones minted declares one more field in its manifest, `rewards: { templateId, templateVersion }`, naming
the contract template it wants (today `game-rewards` at `1.0.0`; the platform's own list says which exist). Every milestone the
game declares is then enabled in that contract, and the most times one address can claim it is the milestone's own policy: once,
or the `maxCount` of a repeatable one (`milestoneClaimLimit`, `rewardsInitialisation` in `@frostbite/shared/games`). The optional
`milestone:claim` capability lets the game ask the platform to start a claim for a player; it needs `rewards`. The player's own
wallet signs and the player pays the network fee. **Nothing mints yet**: the contract and the chain steps are task #73, and the
page lists the capability as granted (the host answers it) while every claim is answered `not-supported` until they exist. Holding a token will mean "claimed", never "earned"
(`docs/product/plan-g7-minting.md`).

## Milestones are self-reported, unless the platform replays them

The platform cannot see inside a game, so a milestone is the game's own report, recorded as `self-reported`
and shown to the player that way. **Nothing that carries money or a privilege (a reward, access, a ranking
prize) may depend on a self-reported milestone.**

A game can offer a stronger level, `replay-verified`, for milestones its rules can decide. It needs no platform change:

1. Write the rules as a pure state machine (`GameVerifier`, `@frostbite/game-sdk/run-record`: `init(seed, config)`,
   `step(state, input)`, `earned(state)`; no clock, no `Math.random`, no I/O) and play through the same module.
2. Add `src/replay.ts` to the game: a default export of the verifier and a named export `sample()` returning one legal
   run. `pnpm game:build` (the SDK's build) emits `verifier.js` and `verifier.json` beside the game.
3. In the manifest, declare the `run:submit` capability, `verification: { replay: { id, sha256, version } }` with the
   digest from `verifier.json`, and `verification: "replay-verified"` on each milestone the rules decide (only
   milestones earned once, with no target). A test prints the digest to pin when it does not match.
4. In the game, call `client.run.start()` for a seed (signed-in players are given one; others get `unavailable` and play on a
   seed of their own, self-reported), record the run with `createRunRecorder`, and `client.run.submit(runId, record)` when
   it ends. The answer is `verified` (with the milestones earned), `rejected` or `refused`.

A game with several replayable cabinets still publishes one verifier: `combineCabinets` (`@frostbite/game-sdk/cabinets`) takes
each cabinet's rules (`cabinet(rules)`), and a record names its cabinet in `config.cabinet`. A real-time game ports to the same
shape by making its rules count ticks instead of reading a clock, recording the player's choices with the tick each was made on,
and letting the screen's timer drive the same step function (`docs/product/run-record.md`).

The platform replays the record on its server and holds the milestone on the account as `replay-verified`; the page shows
it as "Replay-checked", and says what that shows (the run followed the game's rules) and what it does not (that a person
played it; or, for a game with hidden information such as mine positions, that the player did not look). **Only games the
platform plays itself are loaded today**; a game hosted elsewhere stays self-reported until the sandboxed runner exists
(ADR-018 Amendment 2: no sandboxed runner is planned, and replay is optional). The explorer game (`games/sdk-explorer`) shows both calls answering.

## Test and run it

- `pnpm --filter @game/<id> test:unit` for the rules and `test:integration`, which bundles the game and runs it
  in jsdom against a simulated host with storage and network blocked, so a game that reaches outside fails.
- `pnpm --filter web dev` (or `build`) builds every folder under `/games` into the git-ignored
  `apps/web/public/play/<id>`. Open `/games/<id>`: the game is playable on that page.
- A listed game with `launch: embedded` is shown only where it is playable. SDK Explorer is registered only
  when `APP_ENV` is `local` or `test`; a real game is registered for every environment.
- `pnpm game:dev <id>` opens a local test page for the game: it frames the game in the same sandbox, builds it again on each
  reload, and lets you sign the player in and out, connect a fake wallet (and change its network), send the tab-hidden and
  full-screen events, take a claim through its states, and read a log of every call. Outside this repository, the SDK's
  `frostbite-game-dev <folder>` does the same from a `game.json` of the game's id, capabilities and milestones. What the page does is
  made up; the platform's own rules decide what players get.
- `pnpm test:e2e -- tests/game-host.spec.ts` plays SDK Explorer in a real browser through reload.

## Checks every game passes

**Conformance, run automatically.** `apps/web/test/games-conformance.unit.test.ts` runs `checkGameConformance`
(`@frostbite/test-kit/game-conformance`) over every registered embedded game, so nobody has to remember to ask: the page
must be one the frame can serve, the script must bundle, the game must tell the platform it is ready, the platform
must never refuse what it asks (an undeclared milestone, a call too large or too fast), nothing may be thrown
uncaught, and the cover files the manifest names must exist. The same test fails if a folder under `/games` is not registered, or a registered embedded game has no
folder. The runner starts the game in a simulated host with storage and network blocked.

**The browser contract, run automatically.** `tests/e2e/tests/game-contract.spec.ts` opens every game under `games/` in the platform (the games
that are not played on a screen of their own are listed in `tests/e2e/src/player-games.ts`) on every browser profile, the phone included, and
checks what every game does the same way: the first Tab is the skip link, a run starts from a tap on a touch screen and from Enter on a keyboard,
the first-screen card is drawn at the pixels of the display, and no control or screen moves when a run starts or in its first seconds. A new game
gets it by existing. What it does not check, because it depends on how a game plays, stays in a spec of its own: how a run ends, and the card and note after it.

Strict manifest fields; identifier shape and uniqueness; capabilities from the known list; milestone ids unique
within the game (at most 64) and every text bounded (`gameManifestLimits`); the network is a configured chain;
the page checks above; ≤300 lines per source and test file; the repository's lint, typecheck, unit, integration
and coverage gates (above 90%).

## External games (none registered today)

Every game is bundled on the SDK and played here, so no game uses this mode now. A game that cannot be bundled this way (it needs its own server) could still be listed with
`launch: { mode: "external", ... }` and played at an address a deployment sets through `GAME_LAUNCHES`. It is
shown as an external link, gets no saving, no milestones and no frame, and its host must not be the platform's
own origin. The hosting rules are:

- `url` is the host only (no path, no trailing slash); `basePath` is blank for a subdomain-style host or
  `/name` for domain-path style; `returnUrl` must be on `PUBLIC_BASE_URL`'s origin; preview and production
  need HTTPS. A bad value stops the platform starting.
- One build serves both styles only if it names every file relative to its own page. `pnpm --filter @repo/e2e
audit:game -- <folder>` screens for root addresses. With path style, games on one host share an origin, so
  prefer one host per game for anything private.

The launch rules are tested on their own (`packages/shared`) and in a real browser with fixture games (`tests/e2e`
`game-hosting.spec.ts`). Naming a game the platform plays itself in `GAME_LAUNCHES` stops the platform starting.

## Not built yet (see also the roadmap)

| Missing                                                              | Task / blocked on                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| Milestone states beyond "reached" (claim pending, claimed, complete) | After minting exists (G4/G7)                           |
| Minting: `game-rewards` contract, the `mint-milestone` intent        | Contract and mint pipeline (weeks 6 and 7), fee values |
| A verified milestone level                                           | A run-record spike with a real game (G6)               |

Until those exist a game can be played, its progress kept and its milestones shown as the game's own report.
Nothing in the pages implies a milestone can be claimed on chain.
