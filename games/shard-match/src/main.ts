import { setUpSound } from "@ador/game-sdk/audio/setup";
import { createGameClient } from "@ador/game-sdk/client";
import { createPause } from "@ador/game-sdk/pause";
import { connectToPlatform, type PlatformPlay } from "@ador/game-sdk/play";
import { startNote } from "@ador/game-sdk/run-notes";

import { effects, track } from "./audio.ts";
import { tempoFor, toastFor } from "./feedback.ts";
import { followPause, loadTitles, refusalNote, submitRun } from "./submit.ts";
import { boxes, listEarned, setText } from "./dom.ts";
import { hintFor, watchIdle } from "./hint.ts";
import { createPlayback } from "./playback.ts";
import { traceOf } from "./screen/trace.ts";
import { buildTimeline } from "./screen/timeline.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { arrow, tapped, toggled, type Next } from "./picking.ts";
import { type Direction } from "./rules/constants.ts";
import { neighbour } from "./rules/board.ts";
import { milestoneIds } from "./rules/milestones.ts";
import { startRun } from "./rules/state.ts";
import { attachControls } from "./screen/controls.ts";
import { canvasScale, draw, screenHeight, screenWidth } from "./screen/draw.ts";
import type { View } from "./screen/view.ts";
import { createMatchSession, type MatchSession } from "./session.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the network.
// The rules, the session and the screen are in their own modules; this only joins them to the page and the platform.
const client = createGameClient();
const page = boxes();
const {
  count: countOut,
  earned: earnedList,
  note,
  pause: pauseButton,
  screen,
} = page;
const { start: startButton, status, total: totalOut } = page;
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: MatchSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let starting = false;
let earnedCount = 0;
let lastInput = Date.now();
// The idle screen's board.
let backdrop = startRun(1);
let view: View = {
  best: 0,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase: "ready",
  toast: null,
};

const localSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);
const pause = createPause();
const saveProgress = (): void =>
  void client.progress.save({ best: progress.best, sound: progress.sound });
const sound = setUpSound({
  container: page.sound,
  effects,
  pause,
  save: (settings) => {
    progress = withSound(progress, settings);
    saveProgress();
  },
  track,
});

const going = (): boolean => session !== null && !session.state().ended;

// What the writing on the screen says while a swap plays back: the state before it until its steps are done, and after it then.
function shown() {
  const current = session?.state() ?? backdrop;
  const playing = playback.timeline();
  if (playing === null) return current;
  return playing.cues.some((cue) => cue.praise === "LEVEL CLEAR!")
    ? playing.after
    : playing.before;
}

function show(): void {
  if (context === null) return;
  const playing = playback.timeline();
  const bonus =
    playing === null
      ? 0
      : playing.after.score - playing.before.score - playing.after.lastGain;
  draw(context, shown(), view, playback.scene(), bonus);
}

// The playback of the swap just made; when it is over a run that ended is closed (so the last chain is seen to its end).
const playback = createPlayback({
  cue: (cue) => {
    if (cue.sound !== undefined) sound.sfx(cue.sound);
  },
  done: () => {
    const running = session;
    show();
    if (running !== null && running.state().ended) void finish(running);
  },
  draw: () => show(),
  paused: () => pause.paused(),
  schedule: (callback) => void setTimeout(callback, 16),
});

function addEarned(id: string): void {
  earnedCount += 1;
  listEarned(page, id, titles.get(id), earnedCount);
}

function setRunning(running: boolean): void {
  startButton.hidden = running;
  pauseButton.disabled = !running;
}

followPause(pause, pauseButton, note);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && going()) pause.set(true);
});

async function finish(finished: MatchSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  const state = finished.state();
  const record = finished.record();
  const before = progress.best;
  progress = withBest(progress, state.score);
  view = {
    ...view,
    best: progress.best,
    newBest: progress.best > before && state.score > 0,
    phase: "over",
  };
  saveProgress();
  show();
  startButton.textContent = "Play again";
  await submitRun(play, runId, record, (text) => setText(note, text));
}

function swap(cell: number, direction: number): void {
  const running = session;
  if (running === null || !going() || pause.paused()) return;
  // A swap made while another is still playing back ends that playback at once.
  playback.finish();
  const before = running.state();
  const outcome = running.swap(cell, direction);
  view = { ...view, grab: -1, hint: [] };
  if (!outcome.ok) {
    view = { ...view, toast: "NO LINE" };
    sound.sfx("shuffle");
    show();
    return;
  }
  const after = running.state();
  sound.tempo(tempoFor(after.moves));
  view = {
    ...view,
    cursor: neighbour(cell, direction),
    toast: toastFor(after),
  };
  playback.start(
    buildTimeline(
      before,
      after,
      cell,
      direction,
      traceOf(before, cell, direction),
    ),
  );
}

// A hand movement: the next place of the cursor and the shard held, and the swap it asks for, if any.
function act(next: Next): void {
  lastInput = Date.now();
  view = { ...view, ...next.picking };
  if (next.swap === null) show();
  else swap(next.swap.cell, next.swap.direction);
}
const live = (): boolean => going() && !pause.paused();
const move = (direction: Direction): void => {
  if (live()) act(arrow(view, direction));
};
const grab = (): void => {
  if (live()) act({ picking: toggled(view), swap: null });
};
const tap = (cell: number): void => {
  if (live()) act(tapped(view, cell));
};

// After a while without a move the screen points at one.
watchIdle({
  lastInput: () => lastInput,
  quiet: () => going() && !playback.active() && !pause.paused(),
  shown: () => view.hint.length > 0,
  show: () => {
    view = { ...view, hint: hintFor(session?.state() ?? backdrop) };
    show();
  },
});

async function begin(): Promise<void> {
  if (starting) return;
  starting = true;
  const started = await play?.runs.start().catch(() => null);
  const ready = started?.status === "started" ? started : null;
  runId = ready?.runId ?? null;
  setText(
    note,
    startNote(
      started ?? null,
      "Swap neighbouring shards to line up three or more.",
    ),
  );
  session = createMatchSession({
    onEarned: (id) => {
      sound.sfx("milestone");
      addEarned(id);
      view = { ...view, toast: titles.get(id) ?? id };
      play?.report(id);
    },
    seed: ready?.seed ?? localSeed(),
  });
  starting = false;
  earnedCount = 0;
  earnedList.replaceChildren();
  setText(countOut, "0");
  view = {
    ...view,
    cursor: 0,
    grab: -1,
    hint: [],
    newBest: false,
    phase: "running",
    toast: null,
  };
  pause.set(false);
  setRunning(true);
  sound.tempo(1);
  sound.sfx("start");
  sound.music(true);
  show();
}

// Enter starts a run, but never throws away one that is going.
const startFromKey = (): void => {
  if (!startButton.disabled && !going()) void begin();
};

function togglePause(): void {
  if (going()) pause.toggle();
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
    sound.apply(progress.sound);
    view = { ...view, best: progress.best };
    play = await connectToPlatform(client);
    titles = await loadTitles(client);
    setText(status, "Connected.");
  } catch (error) {
    setText(status, refusalNote(error));
  }
  startButton.disabled = false;
  show();
}

screen.width = screenWidth * canvasScale;
screen.height = screenHeight * canvasScale;
setText(totalOut, String(milestoneIds.length));
attachControls(screen, {
  grab,
  move,
  pause: togglePause,
  start: startFromKey,
  swap,
  tap,
});
pauseButton.addEventListener("click", togglePause);
startButton.addEventListener("click", () => void begin());
setRunning(false);
backdrop = startRun(localSeed());
show();
void connect();
