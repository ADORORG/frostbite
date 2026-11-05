# The SDK in one page

Import from `<sdk>/<module>`. Each module below is a separate export.

| Module                          | Use it for                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client`                        | `createGameClient()` and `GameHostError`: every call to the platform.                                                                                                                                                               |
| `play`                          | `connectToPlatform(client)`: reports a milestone only if the manifest declares it; starts and submits runs.                                                                                                                         |
| `seeded`                        | The seeded generator every rule must use instead of `Math.random`.                                                                                                                                                                  |
| `run-inputs`                    | Checking a run input's fields and tick, and refusing with a reason (`withFields`, `tickNamed`, `refuse`).                                                                                                                           |
| `run-record`                    | `GameVerifier`, `createRunRecorder`: the rules as a state machine and the record of a run.                                                                                                                                          |
| `cabinet-runs`                  | `CabinetRuns`: how a cabinet asks the platform for a run and hands back its record. Send a finished run with `sendRun(play, runId, record)` from `play`; it says nothing to the player.                                             |
| `fixed-step`                    | Whole ticks from elapsed time at the game's own rate.                                                                                                                                                                               |
| `run-loop`                      | `createRunLoop`: one animation frame at a time, whole ticks, pause and hidden-tab handling, one start at a time.                                                                                                                    |
| `pause`                         | `createPause`, `pauseCopy`: the one place the screen, sound and clock agree the game is paused.                                                                                                                                     |
| `controls`                      | `attachKeys`, `standardKeys`: Enter starts, P pauses; ignores repeats, Ctrl/Alt/Meta and typing in fields.                                                                                                                          |
| `touch-start`                   | `attachTapToStart(screen, startButton)`: on a touch screen a tap on a waiting game starts a run (Start run is out of sight there).                                                                                                  |
| `touch-zones`                   | `attachZones(screen, { zoneAt, enter, leave, slide, fingersOnly })`: the screen cut into zones; a finger enters and leaves them, each finger on its own. Use it for thumb zones, lanes or steering instead of writing pointer code. |
| `touch`                         | `isTouchScreen()`, `byInput(keyLine, touchLine)`: say "TAP" to a finger and "ENTER" to a keyboard.                                                                                                                                  |
| `audio/setup`                   | `setUpSound`: sound with the player's panel, silenced while paused or hidden.                                                                                                                                                       |
| `audio/effects`, `audio/tracks` | Music and effects as data (`tone`, `commonEffects`, `Track`).                                                                                                                                                                       |
| `audio/settings`                | `defaultSound`, `parseSound`, `SoundSettings`: keep beside the game's progress.                                                                                                                                                     |
| `audio/panel.css`               | Import in the game's stylesheet.                                                                                                                                                                                                    |
| `audio/fake`                    | `installFakeAudio(window)`: tests without a speaker.                                                                                                                                                                                |
| `pixels`                        | `block`, `sprite`, `wrap` for pixel-art on a canvas.                                                                                                                                                                                |
| `cabinets`                      | `combineCabinets`: several replayable cabinets in one verifier.                                                                                                                                                                     |
| `build`                         | Bundles the game and emits `verifier.js` and `verifier.json`.                                                                                                                                                                       |

## Talking to the platform

```ts
const client = createGameClient();
await client.ready(); // first; answers with the player's state
const saved = await client.progress.load(); // JSON or null: untrusted, validate it
await client.progress.save({ best: 12 }); // JSON, at most 64 KB
const list = await client.milestones.list(); // declared milestones with the player's status
await client.milestones.unlock("first-level"); // idempotent; only declared ids
const info = await client.player.info(); // { signedIn, walletConnected }
const who = await client.player.identity(); // { id, kind } opaque per game; kind "local" becomes "account" once
const wallet = await client.wallet.get(); // { address, network } or null; needs capability "wallet"
await client.ui.toast("Level up!"); // short plain text, shown under the game's name
const supported = await client.capabilities.get();
const stop = client.on("lifecycle.changed", ({ state }) => {}); // "paused" when the tab is hidden
```

- Failures are `GameHostError` with a stable `code`: `invalid_request`, `not_ready`, `rate_limited`, `too_large`, `unavailable`,
  `unknown_method`, `unknown_milestone`, `permission_denied`. The game must still be playable when a call fails.
- Do not wait on the platform to start drawing. Do not call `unlock` for a milestone not in the manifest.
- Save plain JSON of your own making, versioned by you, so a save written by an older release still loads.
- `milestones.progress(id, total)` for a milestone with a `target`: send the total, not the change. Do not `unlock` it.
- A `repeatable` milestone needs `maxCount`; read counts with `milestones.counts()`.
- `milestones.claim(id)` needs the `milestone:claim` capability, which needs `rewards` in the manifest. Claims are signed by the
  player's own wallet in the platform's page; the game never sees a wallet, signature or transaction.
- Events: `wallet.changed`, `claim.changed`, `lifecycle.changed`, `fullscreen.changed`, `player.changed`.
- A method or event that exists never changes shape; new abilities are new methods.

## Signatures the rules need

Rules are a `GameVerifier<State>` (`<sdk>/run-record`): `{ id, version, init(seed, config), step(state, input), earned(state) }`.
`init` and `step` return `Stepped<State>`: `{ ok: true, state }` or `{ ok: false, reason }`. They refuse; they never throw.
`RunInput` is `{ type: string, data?: JsonValue }`.

```ts
// <sdk>/seeded: whole-number arithmetic on 32 bits, the same on every engine
startState(seed: number): number                          // a non-zero generator state
stepInt(state: number, below: number): { state: number; value: number }   // a whole number in [0, below)
stepSeed(state: number): { state: number; value: number } // value in [0, 1)
seeded(seed: number): () => number                        // a closure, for code that keeps no state value

// <sdk>/run-inputs: check an input before acting on it
refuse(reason: string): { ok: false; reason: string }
fieldsOf(data, names: readonly string[]): Record<string, JsonValue> | string  // exactly these keys, or why not
tickNamed(value, now: number, last: number): number | string  // a whole tick from `now` to `last`, or why not
withFields(data, names, act: (fields) => Stepped<State>): Stepped<State>      // fieldsOf then act

// <sdk>/run-record
createRunRecorder({ config, gameId, seed, verifier, verifierVersion })  // .input(type, data), .finish(claims) -> RunRecord
```

A real-time game keeps no clock in its rules: each input names the `tick` it happened on, `step` replays the ticks since the last
input (`advanceTo`), then applies the input. Keep `maxTicks` as the bound on the work one replay does.
