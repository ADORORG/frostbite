import { setUpSound } from "@ador/game-sdk/audio/setup";
import { createGameClient, GameHostError } from "@ador/game-sdk/client";
import { createPause, pauseCopy } from "@ador/game-sdk/pause";
import { connectToPlatform, type PlatformPlay } from "@ador/game-sdk/play";
import { attachTapToStart } from "@ador/game-sdk/touch-start";
import {
  startNote,
  submitNote,
  type SubmitState,
} from "@ador/game-sdk/run-notes";

import { effects, track } from "./audio.ts";
import { stepSounds, tempoFor } from "./feedback.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { directions, type Direction } from "./rules/constants.ts";
import { milestoneIds } from "./rules/milestones.ts";
import { startRun } from "./rules/state.ts";
import { attachControls } from "./screen/controls.ts";
import { canvasScale, draw, screenHeight, screenWidth } from "./screen/draw.ts";
import { lanternPoint } from "./screen/layout.ts";
import type { View } from "./screen/view.ts";
import { createMazeSession, type MazeSession } from "./session.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the network.
// The rules, the session and the screen are in their own modules; this only joins them to the page and the platform. Everything that
// changes while a run is played is drawn on the canvas or written into a box of fixed size.
function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
) {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  return found as HTMLElementTagNameMap[Tag];
}

// Writes text only if it differs, so a box that has not changed is not touched.
function setText(box: HTMLElement, text: string): void {
  if (box.textContent !== text) box.textContent = text;
}

const client = createGameClient();
const status = element("status", "p");
const note = element("note", "p");
const screen = element("screen", "canvas");
const countOut = element("count", "strong");
const totalOut = element("total", "span");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const pad = element("pad", "div");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: MazeSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let starting = false;
let heldNote = "";
let earnedCount = 0;
// The idle screen's cellar.
let backdrop = startRun(1);
let view: View = { best: 0, newBest: false, phase: "ready", toast: null };

const localSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);
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

const going = (): boolean => {
  const state = session?.state();
  return state !== undefined && !state.ended;
};

function show(): void {
  if (context !== null) draw(context, session?.state() ?? backdrop, view);
}

function addEarned(id: string): void {
  earnedCount += 1;
  setText(countOut, String(earnedCount));
  const item = document.createElement("li");
  item.dataset.milestone = id;
  item.textContent = titles.get(id) ?? id;
  earnedList.append(item);
  earnedList.scrollTop = earnedList.scrollHeight;
}

function setRunning(running: boolean): void {
  startButton.hidden = running;
  pauseButton.disabled = !running;
  for (const button of pad.querySelectorAll("button"))
    button.disabled = !running;
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    setText(note, pauseCopy.paused);
    return;
  }
  setText(note, heldNote);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && going()) pause.set(true);
});

async function finish(finished: MazeSession): Promise<void> {
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
  startButton.textContent = "Light another";
  if (runId === null || play === null) {
    setText(note, submitNote(null));
    return;
  }
  const sent = runId;
  setText(note, submitNote({ kind: "pending" }));
  const settled: SubmitState = await play.runs.submit(sent, record).then(
    (result) => ({ kind: "settled", result }) as const,
    () => ({ kind: "failed" }) as const,
  );
  setText(note, submitNote(settled));
}

function choose(direction: Direction): void {
  const running = session;
  if (running === null || !going() || pause.paused()) return;
  const before = running.state();
  if (!running.move(direction).ok) return;
  const after = running.state();
  for (const name of stepSounds(before, after)) sound.sfx(name);
  sound.tempo(tempoFor(after.oil));
  show();
  if (after.ended) void finish(running);
}

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
      "Find the key, then the door. Every step burns oil; flasks add some.",
    ),
  );
  session = createMazeSession({
    onEarned: (id) => {
      sound.sfx("milestone");
      addEarned(id);
      view = {
        ...view,
        toast: {
          text: titles.get(id) ?? id,
          until: (session?.state().moves ?? 0) + 14,
        },
      };
      play?.report(id);
    },
    seed: ready?.seed ?? localSeed(),
  });
  starting = false;
  earnedCount = 0;
  earnedList.replaceChildren();
  setText(countOut, "0");
  view = { ...view, newBest: false, phase: "running", toast: null };
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
    titles = new Map(
      (await client.milestones.list().catch(() => [])).map(({ id, title }) => [
        id,
        title,
      ]),
    );
    setText(status, "Connected.");
  } catch (error) {
    setText(
      status,
      error instanceof GameHostError
        ? `The platform said: ${error.code}`
        : "Could not connect to the platform. You can still play.",
    );
  }
  startButton.disabled = false;
  show();
}

screen.width = screenWidth * canvasScale;
screen.height = screenHeight * canvasScale;
setText(totalOut, String(milestoneIds.length));
attachControls(
  screen,
  {
    move: choose,
    pause: togglePause,
    start: startFromKey,
  },
  () => {
    const state = session?.state();
    return state === undefined || state.ended
      ? null
      : lanternPoint(
          state.layout.maze.width,
          state.layout.maze.height,
          state.position,
        );
  },
);
for (const direction of directions)
  pad
    .querySelector(`[data-direction="${direction}"]`)
    ?.addEventListener("click", () => choose(direction));
pauseButton.addEventListener("click", togglePause);
attachTapToStart(screen, startButton);
startButton.addEventListener("click", () => void begin());
setRunning(false);
backdrop = startRun(localSeed());
show();
void connect();
