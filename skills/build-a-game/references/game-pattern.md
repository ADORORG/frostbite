# The shape of a finished game

Every game on the platform behaves the same way. Use the SDK's pieces; do not write your own.

## Layers (keep them apart, each testable alone)

1. **Rules** (`src/rules/`): a pure state machine. `init(seed)`, `step(state, input)`, `earned(state)`. No DOM, no clock, no
   `Math.random`, no I/O. Time is counted in ticks at a fixed rate; a level or board is generated from the seed.
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
- A visible **Pause** button, and a **sound panel** at the bottom left of the foot (`#sound`), never floating over the game.
- **Sound**: `setUpSound({ container, effects, pause, save, track })`. Import the panel stylesheet. The panel says "Sound starts when
  you press a key" until the browser allows audio, and says so when there is no audio. Keep `SoundSettings` beside progress and
  read it back with `parseSound`.
- **One loop**: `createRunLoop({ frame, page: document, pause, ticksPerSecond })`. `frame(ticks)` advances the session by that many
  whole ticks and returns whether to keep going. Pausing adds no input and no tick, so a paused run replays like any other.
- **A layout that does not move**: nothing under the player's thumb moves during a run. A button that is not offered keeps its place
  (`visibility: hidden`, not `display: none`); buttons have a fixed minimum width; the note, the earned list and the score row have
  heights that never grow; scores do not wrap.
- **Touch**: the screen is the controller, with as few buttons as the game can do without (on a touch screen `phone.css` keeps only a pause
  icon and two sound icons, over the screen). A one-button game takes a tap on the canvas; a game with directions takes swipes; a game with
  run and jump takes a thumb stick on the left half and a hold on the right (see `games/bro-maria/src/screen/thumbs.ts`). Call
  `attachTapToStart(screen, startButton)` so a tap on a waiting game starts a run, and say "TAP" where a keyboard is told "ENTER"
  (`byInput`, or `touchLines` and the guide's own touch start line). Keep a button only where a gesture cannot do the job.
- **Styles**: copy the stylesheet of the closest finished game and change its colours; it already has the steady layout, the sound
  panel's place, the `visibility` rule for hidden buttons and the touch rules. Do not write a layout from nothing.
- **Plays without the platform**: a failed `ready()` or `run.start()` shows a note and the game still starts on a seed of its own
  (its milestones are then self-reported).

## Page skeleton

`index.html` holds a `header` with the title and `#status`, the score row, a `canvas#screen` (with `role="img"` and an `aria-label`
describing it), a foot with `#sound`, `#note` (`aria-live="polite"`) and the Start and Pause buttons, and a list of milestones
earned this run. Start and Pause begin `disabled`. See `games/bro-maria/index.html` if the repository is available.

## main.ts outline

```ts
const client = createGameClient();
const pause = createPause();
const sound = setUpSound({
  container: sound,
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
    const started = await play?.runs.start().catch(() => null); // a server-issued seed, or null
    session = createRunSession({
      seed: started?.seed ?? localSeed(),
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

On finish: stop the music, record the best score, `play.runs.submit(runId, session.record())` if a run was issued, and tell the
player what became of it with `submitNote`.

## Untrusted values

The save, every platform answer and every key event are untrusted. Validate with explicit type checks or a schema; return a concrete
type. `unknown` appears only at that boundary and is contained there.
