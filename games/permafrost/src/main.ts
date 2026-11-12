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
import { soundsFor, tempoScale } from "./feedback.ts";
import { guide } from "./guide.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import { levelOf } from "./rules/difficulty.ts";
import type { Action } from "./rules/types.ts";
import { attachControls } from "./screen/controls.ts";
import { draw } from "./screen/draw.ts";
import { screenHeight, screenWidth } from "./screen/layout.ts";
import { resultOf } from "./screen/result.ts";
import { attachTouch } from "./screen/touch.ts";
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
const page = document.querySelector("main");
// The first-screen card and the card after a run are drawn over the screen at the pixels of the display, so they stay sharp when the small
// screen is scaled up.
const guideLayer = createGuideLayer(screen);
const scoreOut = element("score", "strong");
const bestOut = element("best", "strong");
const linesOut = element("lines", "strong");
const levelOut = element("level", "strong");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
// What the screen shows before a first run: an empty board, waiting. It is never played and never recorded.
const waiting = createRunSession({ seed: 1 });
let view: View = { best: 0, newBest: false, phase: "ready", toast: null };
let runId: string | null = null;
let titles = new Map<string, string>();
let heldNote = "";
// The touch controls (thumb zones and corner buttons) exist only while a run goes, so the first screen and the card after a run are not
// covered by buttons, and a tap there starts a run.
let stopTouch: (() => void) | null = null;

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
  linesOut.textContent = String(state.lines);
  levelOut.textContent = String(levelOf(state.lines));
  if (context === null) return;
  draw(context, { state });
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
  pauseButton.disabled = !running;
}

// A key let go while the page was not looking (paused, or another window) never comes up, so the run lets go of everything itself.
function releaseAll(): void {
  for (const held of ["left", "right", "soft"] as const)
    session?.hold(held, false);
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    releaseAll();
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});
window.addEventListener("blur", releaseAll);

// Runs `change` on the session and plays what it caused, from the run before and after.
function perform(running: RunSession, change: () => void): void {
  const before = running.state();
  change();
  const after = running.state();
  for (const name of soundsFor(before, after)) sound.sfx(name);
  if (levelOf(after.lines) !== levelOf(before.lines))
    sound.tempo(tempoScale(levelOf(after.lines)));
}

const loop = createRunLoop({
  frame(ticks) {
    const running = session;
    if (running === null) return false;
    for (let at = 0; at < ticks && !running.over(); at += 1)
      perform(running, () => running.tick());
    show();
    if (!running.over()) return true;
    void finish(running);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

async function finish(finished: RunSession): Promise<void> {
  stopTouch?.();
  stopTouch = null;
  releaseAll();
  setRunning(false);
  sound.music(false);
  const record = finished.record();
  const done = finishRun(progress, finished.state().score);
  progress = done.progress;
  view = { ...view, best: progress.best, newBest: done.newBest, phase: "over" };
  saveProgress();
  show();
  startButton.textContent = "Go again";
  await sendRun(play, runId, record);
}

// Whether a key reaches the run: one is going, and the page is not paused.
function live(): RunSession | null {
  return session !== null && loop.active() ? session : null;
}

const press = (action: Action, tone?: "turn" | "hold") => (): void => {
  const running = live();
  if (running === null) return;
  perform(running, () => {
    if (running.press(action) && tone !== undefined) sound.sfx(tone);
  });
  show();
  if (running.over()) {
    loop.stop();
    void finish(running);
  }
};

const held =
  (control: "left" | "right" | "soft") =>
  (on: boolean): void => {
    live()?.hold(control, on);
  };

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    note.textContent = byInput(
      "Arrows move and turn, Space drops, C holds.",
      "Slide a thumb to move, tap to turn.",
    );
    session = createRunSession({
      onEarned: (id) => {
        sound.sfx("milestone");
        play?.report(id);
        listEarned(session?.earned() ?? []);
      },
      seed: ready?.seed ?? localSeed(),
    });
    view = { ...view, newBest: false, phase: "running", toast: null };
    stopTouch?.();
    stopTouch = page === null ? null : attachTouch(screen, page, controls);
    listEarned([]);
    setRunning(true);
    sound.tempo(1);
    sound.sfx("start");
    sound.music(true);
  });

// Enter starts a run; once one is going it does nothing, so it never throws a run away.
function enter(): void {
  if (!loop.running() && !startButton.disabled) void begin();
}

// Space drops a piece while a run is going, and does nothing otherwise: a player still dropping pieces as the run ends must not start
// the next run by accident, and lose the card that says how they did. Enter or a tap starts one.
const hard = (): void => {
  if (loop.running()) press("hard")();
};

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
const controls = {
  hard,
  hold: press("hold", "hold"),
  left: held("left"),
  pause: () => void (loop.running() && pause.toggle()),
  right: held("right"),
  soft: held("soft"),
  start: enter,
  turnLeft: press("turnLeft", "turn"),
  turnRight: press("turnRight", "turn"),
};
attachControls(controls);
pauseButton.addEventListener("click", controls.pause);
attachTapToStart(screen, startButton);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
