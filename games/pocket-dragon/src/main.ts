import { setUpSound } from "@frostbite/game-sdk/audio/setup";
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";
import { createPause, pauseCopy } from "@frostbite/game-sdk/pause";
import {
  connectToPlatform,
  sendRun,
  type PlatformPlay,
} from "@frostbite/game-sdk/play";
import { createRunLoop } from "@frostbite/game-sdk/run-loop";
import { attachTapToStart } from "@frostbite/game-sdk/touch-start";

import { effects, trackOf, tracks } from "./audio.ts";
import {
  nurseryNote,
  nurseryRun,
  type NurseryRun,
} from "./bonus/nursery-run.ts";
import { factsOf, type LastRun } from "./card/content.ts";
import { instructions } from "./guide.ts";
import { createCardPanel, noteMarks } from "./page/card-panel.ts";
import { element } from "./page/elements.ts";
import { attachHands, playOfKey, type Action } from "./page/hands.ts";
import { createIdleRuns, startPlay } from "./page/plays.ts";
import { resultOf } from "./page/result.ts";
import type { PlayRun, Shown } from "./page/runs.ts";
import { settle } from "./page/settle.ts";
import { attachTestMode, testNote, testOverNote } from "./page/test-panel.ts";
import { attachThumbs } from "./page/thumbs.ts";
import { createView, pickedFrom } from "./page/view.ts";
import {
  freshProgress,
  isOpen,
  restore,
  saved,
  withSound,
  type Progress,
} from "./progress.ts";
import { ticksPerSecond, type PlayId } from "./rules/constants.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the
// network. The rules, the sessions and the screen are in their own modules; this only joins them to the page and the platform.
const client = createGameClient();
const status = element("status", "p");
const note = element("note", "p");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const picker = element("chapters", "nav");
const shareButton = element("share", "button");
const nurseryButton = element("nursery", "button");
const stage = element("stage", "div");
const view = createView({ hold });

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let chosen: PlayId = "quest";
let run: PlayRun | null = null;
// The level last shown, so the touch buttons and the music change only when it does.
let shownLevel: Shown | null = null;
let runId: string | null = null;
let titles: ReadonlyMap<string, string> = new Map();
let heldNote = "";
// For the player's card: the last run, and the milestones the player is known to have (the platform's list, and what runs here earned).
let lastRun: LastRun | null = null;
// The secret Sky Nursery, open once the quest is won (and in test mode): the visit going on, and the last one, for its cards.
let visit: NurseryRun | null = null;
let lastVisit: NurseryRun | null = null;
const nurseryOpen = (): boolean => progress.won || testMode.on();
const marks = new Set<string>();
const card = createCardPanel(() => shareButton.focus());

const localSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);

const pause = createPause();
const saveProgress = (): void => void client.progress.save(saved(progress));
const sound = setUpSound({
  container: element("sound", "div"),
  effects,
  pause,
  save: (settings) => {
    progress = withSound(progress, settings);
    saveProgress();
  },
  track: tracks.hills,
});

const idleRun = createIdleRuns();

function show(): void {
  const shown = run ?? idleRun(chosen);
  const level = shown.screen ?? shown.level();
  if (level !== shownLevel) {
    shownLevel = level;
    view.level(level);
    if (run !== null && !run.ended()) sound.sound.playMusic(trackOf(level));
  }
  view.draw(shown, run === null, progress.best[shown.id], progress.plasma);
}

// What is open to choose: every level in the admin's test mode (`page/test-panel.ts`), whose runs count for nothing.
const reach = (): Progress =>
  testMode.on() ? { ...progress, unlocked: 3 } : progress;

function showChapters(): void {
  const running = run !== null && !run.ended();
  view.chapters(chosen, reach(), running);
  nurseryButton.hidden = !nurseryOpen();
  nurseryButton.disabled = running;
}

function choose(id: PlayId): void {
  if (loop.running() || !isOpen(reach(), id) || id === chosen) return;
  chosen = id;
  run = null;
  view.earned([], titles);
  note.textContent = "";
  showChapters();
  show();
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  pauseButton.dataset.paused = String(paused);
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});

async function finish(finished: PlayRun): Promise<void> {
  view.running(false);
  sound.sound.stopMusic();
  lastVisit = finished === visit ? visit : null;
  if (finished.test) {
    note.textContent = finished.overNote ?? testOverNote;
    view.over(resultOf({ best: 0, finished, newBest: false, next: chosen }));
    showChapters();
    show();
    return;
  }
  const record = finished.record();
  const after = settle(progress, finished);
  const news = after.news;
  progress = after.progress;
  lastRun = after.lastRun;
  shareButton.classList.add("fresh");
  if (finished.id !== "quest" && after.opened !== null) chosen = after.opened;
  const best = progress.best[finished.id];
  view.over(resultOf({ best, finished, newBest: after.newBest, next: chosen }));
  saveProgress();
  showChapters();
  view.fame(progress.fame);
  show();
  startButton.textContent = finished.id === chosen ? "Play again" : "Start run";
  note.textContent = news;
  await sendRun(play, runId, record);
}

const loop = createRunLoop({
  frame(ticks) {
    const current = run;
    if (current === null) return false;
    for (let at = 0; at < ticks && !current.ended(); at += 1)
      for (const name of current.tick()) sound.sfx(name);
    view.earned(current.earned(), titles);
    if (!current.ended()) {
      show();
      return true;
    }
    void finish(current);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

// A test run asks the platform for nothing: it has no run to submit and earns nothing to report.
async function startRealRun(): Promise<PlayRun> {
  const started = await play?.runs.start().catch(() => null);
  const ready = started?.status === "started" ? started : null;
  runId = ready?.runId ?? null;
  note.textContent = instructions(chosen);
  return startPlay(chosen, ready?.seed ?? localSeed(), (id) => {
    sound.sfx("milestone");
    play?.report(id);
    marks.add(id);
  });
}

const begin = (nursery = false): Promise<void> =>
  loop.launch(async () => {
    visit = nursery ? nurseryRun(localSeed()) : null;
    if (visit !== null) {
      runId = null;
      note.textContent = nurseryNote;
      run = visit;
    } else if (testMode.on()) {
      runId = null;
      note.textContent = testNote;
      run = startPlay(chosen, localSeed(), undefined, true);
    } else run = await startRealRun();
    view.earned([], titles);
    view.running(true);
    showChapters();
    sound.sfx("start");
    shownLevel = run.screen ?? run.level();
    view.level(shownLevel);
    sound.sound.playMusic(trackOf(shownLevel));
  });

const learnMarks = () => noteMarks(client, marks);

function openCard(): void {
  if (loop.running()) return;
  shareButton.classList.remove("fresh");
  const facts = () =>
    factsOf(progress, lastRun, marks, titles, document.referrer);
  card.open(facts());
  void learnMarks().then(() => card.update(facts()));
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
    sound.apply(progress.sound);
    view.fame(progress.fame);
    play = await connectToPlatform(client);
    titles = new Map((await learnMarks()).map(({ id, title }) => [id, title]));
    status.textContent = "Connected.";
  } catch (error) {
    status.textContent =
      error instanceof GameHostError
        ? `The platform said: ${error.code}`
        : "Could not connect to the platform. You can still play.";
  }
  startButton.disabled = false;
  showChapters();
  show();
}

const togglePause = (): void => void (loop.running() && pause.toggle());
// No dialog is open over the page.
const free = (): boolean => !card.isOpen() && !testMode.isOpen();
// The controls are let go of and held even while paused, so a key let go of during a pause is not held on resume. During a run every key
// and thumb goes to it; between runs, 0 chooses the whole quest and 1, 2 and 3 a level to practise, and 4 opens the Sky Nursery once won.
function hold(action: Action, on: boolean): void {
  if (loop.running()) run?.hold(action, on);
  const pick = playOfKey(action);
  if (!loop.running() && free() && on && pick !== undefined) choose(pick);
  if (on && action === "hot4" && nurseryOpen() && free()) void begin(true);
}
const canStart = (): boolean => !startButton.disabled && free();
attachHands(document.body, {
  hold,
  pause: togglePause,
  start: () => void (canStart() && begin()),
});
attachThumbs(stage, hold);
attachTapToStart(stage, startButton);
picker.addEventListener("click", (event) => {
  const id = pickedFrom(event);
  if (id !== undefined) choose(id);
});
pauseButton.addEventListener("click", togglePause);
startButton.addEventListener("click", () => void begin());

// Test mode, on or off. Leaving it ends a test run being played.
function setTesting(on: boolean): void {
  if (!on && loop.running()) {
    loop.stop();
    pause.set(false);
    sound.sound.stopMusic();
  }
  run = null;
  if (!isOpen(reach(), chosen)) chosen = "quest";
  view.testing(on);
  view.running(false);
  view.earned([], titles);
  note.textContent = on ? testNote : "";
  showChapters();
  show();
}
const testMode = attachTestMode({
  canOpen: () => !loop.running() && !card.isOpen(),
  changed: setTesting,
});
shareButton.addEventListener("click", () =>
  lastVisit === null ? openCard() : card.openNursery(lastVisit.nursery()),
);
nurseryButton.addEventListener(
  "click",
  () => void (nurseryOpen() && free() && begin(true)),
);
view.running(false);
showChapters();
show();
void connect();
