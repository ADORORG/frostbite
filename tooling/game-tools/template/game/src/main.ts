import { setUpSound } from "@frostbite/game-sdk/audio/setup";
import {
  finishRun,
  freshProgress,
  restore,
  withSound,
  type Progress,
} from "@frostbite/game-sdk/best-progress";
import { cardFor } from "@frostbite/game-sdk/card";
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";
import { createGuideLayer } from "@frostbite/game-sdk/guide-layer";
import { createPause, pauseCopy } from "@frostbite/game-sdk/pause";
import {
  connectToPlatform,
  type PlatformPlay,
  sendRun,
} from "@frostbite/game-sdk/play";
import { createRunLoop } from "@frostbite/game-sdk/run-loop";
import { byInput } from "@frostbite/game-sdk/touch";
import { attachTapToStart } from "@frostbite/game-sdk/touch-start";

import { effects, track } from "./audio.ts";
import { tapSound, tempoScale } from "./feedback.ts";
import { guide } from "./guide.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import { attachControls } from "./screen/controls.ts";
import { draw } from "./screen/draw.ts";
import { screenHeight, screenWidth } from "./screen/layout.ts";
import { resultOf } from "./screen/result.ts";
import type { View } from "./screen/view.ts";
import { createRunSession, type RunSession } from "./session.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the
// network. The rules, the session and the screen are in their own modules; this only joins them to the page and the platform.
function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
) {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  return found as HTMLElementTagNameMap[Tag];
}

const client = createGameClient();
const status = element("status", "p");
const note = element("note", "p");
const screen = element("screen", "canvas");
// The first-screen card and the card after a run are drawn over the screen at the pixels of the display, so they stay sharp when the small
// screen is scaled up.
const guideLayer = createGuideLayer(screen);
const scoreOut = element("score", "strong");
const bestOut = element("best", "strong");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const catchButton = element("catch", "button");
const pauseButton = element("pause", "button");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
// What the screen shows before a first run: the marker at the start of the lane, waiting. It is never played and never recorded.
const waiting = createRunSession({ seed: 1 });
let view: View = { best: 0, newBest: false, phase: "ready", toast: null };
let runId: string | null = null;
let titles = new Map<string, string>();
let heldNote = "";

const pause = createPause();
const saveProgress = (): void =>
  void client.progress.save({ best: progress.best, sound: progress.sound });
const sound = setUpSound({
  container: element("sound", "div"),
  effects,
  pause,
  save: (settings) => {
    progress = withSound(progress, settings);
    saveProgress();
  },
  track,
});

const localSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);

function show(): void {
  const shown = session ?? waiting;
  const state = shown.state();
  scoreOut.textContent = String(state.score);
  bestOut.textContent = String(progress.best);
  if (context === null) return;
  draw(context, { markerAt: shown.markerAt(), state });
  guideLayer.show(cardFor(view.phase, guide, () => resultOf(state, view)));
}

function listEarned(ids: readonly string[]): void {
  earnedList.replaceChildren(
    ...ids.map((id) => {
      const item = document.createElement("li");
      item.dataset.milestone = id;
      item.textContent = titles.get(id) ?? id;
      return item;
    }),
  );
}

function setRunning(running: boolean): void {
  startButton.hidden = running;
  catchButton.disabled = !running;
  pauseButton.disabled = !running;
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});

const loop = createRunLoop({
  frame(ticks) {
    const running = session;
    if (running === null) return false;
    for (let at = 0; at < ticks && !running.state().ended; at += 1)
      running.tick();
    show();
    if (!running.state().ended) return true;
    void finish(running);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

async function finish(finished: RunSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  const done = finishRun(progress, finished.state().score);
  progress = done.progress;
  view = { ...view, best: progress.best, newBest: done.newBest, phase: "over" };
  saveProgress();
  show();
  startButton.textContent = "Go again";
  await sendRun(play, runId, finished.record());
}

function catchIt(): void {
  const running = session;
  if (running === null || !loop.active()) return;
  const before = running.state();
  running.tap();
  const after = running.state();
  sound.sfx(tapSound(before, after));
  sound.tempo(tempoScale(after.speed));
  listEarned(running.earned());
  show();
  if (after.ended) {
    loop.stop();
    void finish(running);
  }
}

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    note.textContent = byInput(
      "Space catches the marker in the zone.",
      "Tap to catch the marker in the zone.",
    );
    session = createRunSession({
      onEarned: (id) => {
        sound.sfx("milestone");
        play?.report(id);
      },
      seed: ready?.seed ?? localSeed(),
    });
    view = { ...view, newBest: false, phase: "running", toast: null };
    listEarned([]);
    setRunning(true);
    sound.tempo(1);
    sound.sfx("start");
    sound.music(true);
  });

// Enter starts a run, and catches once one is going.
function enter(): void {
  if (loop.running()) catchIt();
  else if (!startButton.disabled) void begin();
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
    view = { ...view, best: progress.best };
    sound.apply(progress.sound);
    play = await connectToPlatform(client);
    titles = new Map(
      (await client.milestones.list().catch(() => [])).map(({ id, title }) => [
        id,
        title,
      ]),
    );
    status.textContent = "Connected.";
  } catch (error) {
    status.textContent =
      error instanceof GameHostError
        ? `The platform said: ${error.code}`
        : "Could not connect to the platform. You can still play.";
  }
  startButton.disabled = false;
  show();
}

screen.width = screenWidth;
screen.height = screenHeight;
attachControls(screen, {
  catchIt,
  pause: () => void (loop.running() && pause.toggle()),
  start: enter,
});
catchButton.addEventListener("click", catchIt);
pauseButton.addEventListener(
  "click",
  () => void (loop.running() && pause.toggle()),
);
attachTapToStart(screen, startButton);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
