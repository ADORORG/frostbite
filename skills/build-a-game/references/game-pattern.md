# The shape of a finished game

Every game on the platform behaves the same way. Use the SDK's pieces; do not write your own.

## Layers (keep them apart, each testable alone)

1. **Rules** (`src/rules/`): a pure state machine. `init(seed, config)`, `step(state, input)` (each answers `ok` with the new state, or
   refuses with a reason) and `earned(state)`. No DOM, no clock, no `Math.random`, no I/O. Time is counted in ticks at a fixed rate; a
   level or board is generated from the seed.
2. **Session** (`src/session.ts`): one run as the player plays it. It calls the rules, writes each accepted input (with its tick) into a
   run record, and tells the page when a milestone is earned. Only changes of input are recorded, never the ticks between.
3. **Screen** (`src/screen/`): draws a state. Pure functions of state; no game logic.
4. **Audio and feedback** (`src/audio.ts`, `src/feedback.ts`): sound as data, and a pure function from "state before, state after" to
   the effect names to play.
5. **Progress** (`src/progress.ts`): the shape of what is saved (`best`, `sound`), with `restore(unknown)` that validates anything
   the platform hands back and falls back to a fresh game.
6. **Page** (`src/main.ts`): joins the above to the DOM and the platform. It saves nothing itself.
7. **Verifier** (`src/replay.ts`): a default export of the rules and a named export `sample()` returning one legal run.

## Behaviour every game has

- **Enter** starts or restarts (never throws away a run that is going). **P** pauses and resumes. Space pauses only if it is not the
  game's main action. Use `attachKeys(window, standardKeys, handlers)`. When the game's own action key is Enter (or Space), let the
  same key start a run when none is going and act during one, as Tower Stacker and Snowball Dash do: that keeps both "Enter never
  throws a run away" and a one-button game true. Map extra keys by spreading `standardKeys`: `{ ...standardKeys, Space: "hop" }`.
- A visible **Pause** button, and on a wide screen a **sound panel** at the bottom left of the foot (`#sound`), never floating over the game
  (a touch screen is laid out differently: see "Touch").
- **Sound**: `setUpSound({ container, effects, pause, save, track })`. Import the panel stylesheet. The panel says "Sound starts when
  you press a key" until the browser allows audio, and says so when there is no audio. Keep `SoundSettings` beside progress and
  read it back with `parseSound`.
- **One loop**: `createRunLoop({ frame, page: document, pause, ticksPerSecond })`. `frame(ticks)` advances the session by that many
  whole ticks and returns whether to keep going. Pausing adds no input and no tick, so a paused run replays like any other.
- **A layout that does not move**: nothing under the player's thumb moves during a run. A button that is not offered keeps its place
  (`visibility: hidden`, not `display: none`); buttons have a fixed minimum width; the note, the earned list and the score row have
  heights that never grow; scores do not wrap.
- **Touch**: the screen is the controller, with as few buttons as the game can do without (what a touch screen shows is in `SKILL.md`,
  "Phones and notes"). A one-button game takes a tap on the canvas
  (`games/snowball-dash/src/screen/controls.ts`); a board takes taps and drags (`games/shard-match/src/screen/controls.ts`). A game
  whose hands depend on where the finger is uses `attachZones` (`<sdk>/touch-zones`), so write only where the zones are and not your
  own pointer handling: steering toward the finger (`games/lantern-maze/src/screen/controls.ts`), a tap in a lane
  (`games/aurora-pulse/src/screen/controls.ts`), or the screen cut in zones where a finger holds the zone under it and one thumb can
  run while the other jumps (`games/bro-maria/src/screen/thumbs.ts`). Name the zones faintly on the first screen of a run, as Bro Maria
  does, so a new player sees what each side does. A game that also needs a few extra buttons (fire, a special move) uses
  `attachTouchButtons` (`<sdk>/touch-buttons`): at most four, drawn over the screen in the bottom right corner by `phone.css`, never a
  pad under it; a finger on a button never reaches the screen's zones. More actions than that: one button that cycles them, or keys. Call `attachTapToStart(screen, startButton)` so a tap on a waiting game starts a
  run, and say "TAP" where a keyboard is told "ENTER" (`byInput`, or `touchLines` and the guide's own touch start line). Keep a button
  only where a gesture cannot do the job, and draw it over the screen, never in rows under it.
- **The note**: one short line under the screen, worded with `byInput` for a keyboard and for a finger, and never about how a run was
  checked (the rule is in `SKILL.md`, "Phones and notes").
- **Styles**: copy the stylesheet of the closest finished game and change its colours; it already has the steady layout, the sound
  panel's place, the `visibility` rule for hidden buttons and the touch rules. Do not write a layout from nothing.
- **Sharp cards**: never write the first-screen card (title, how to play, how to begin) or the card after a run (score, best) on the game's own canvas: the page scales
  that canvas up and blurs the writing, on a phone worst of all. Give the game a `guide.ts` (a `Guide`: `title`, `lines`, `start`, and
  `touchLines` where a phone is told something else), lay it over the screen with `createGuideLayer(screen)` from
  `<sdk>/guide-layer`, and `show(guide)` while the game is waiting to begin and `show(null)` once a run starts. The card after a run is a
  `ResultCard` (rows of `text`, `colour` from the game's palette, and `weight` from the SDK's `resultWeight`) the same layer shows: `show(resultOf(state, view))`, where
  the game's `resultOf` returns null unless the run is over.
- **Plays without the platform**: a failed `ready()` only changes the status line, a failed `run.start()` says nothing, and the game
  still starts on a seed of its own (its milestones are then self-reported).

## Page skeleton

`index.html` holds, straight inside `main`: a `.bar` with the `header` (title and `#status`) and the score row; the `canvas#screen` (with
`role="img"` and an `aria-label` describing it); a `.foot` with `#sound`, `#note` (`aria-live="polite"`) and `.actions` (the Start and Pause
buttons); and a list of milestones earned this run in a `section`. Start and Pause begin `disabled`. `phone.css` lays a phone's page out by
these names, so a page that leaves them out does not fit one. See `games/bro-maria/index.html` if the repository is available.

## main.ts outline

```ts
const client = createGameClient();
const pause = createPause();
const sound = setUpSound({
  container: element("sound", "div"), // the game's own helper: the element with that id, or a clear error
  effects,
  pause,
  save: (s) => {
    progress = withSound(progress, s);
    save();
  },
  track,
});
const loop = createRunLoop({ frame, page: document, pause, ticksPerSecond });
const begin = () =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null); // a server-issued run, or null
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null; // what `sendRun` needs when the run ends
    session = createRunSession({
      seed: ready?.seed ?? localSeed(),
      onEarned: (id) => {
        sound.sfx("milestone");
        play?.report(id);
      },
    });
    sound.sfx("start");
    sound.music(true);
  });
async function connect() {
  await client.ready();
  progress = restore(await client.progress.load());
  sound.apply(progress.sound);
  play = await connectToPlatform(client);
}
```

On finish: stop the music, record the best score, and `await sendRun(play, runId, session.record())`. It does nothing if no run was
issued, drops a failure quietly, and the screen says nothing about it.

## Untrusted values

The save, every platform answer and every key event are untrusted. Validate with explicit type checks or a schema; return a concrete
type. `unknown` appears only at that boundary and is contained there.
