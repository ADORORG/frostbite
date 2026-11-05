import { setUpSound } from "@frostbite/game-sdk/audio/setup";
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";
import { createGuideLayer } from "@frostbite/game-sdk/guide-layer";
import { createPause, pauseCopy } from "@frostbite/game-sdk/pause";
import {
  connectToPlatform,
  type PlatformPlay,
  sendRun,
} from "@frostbite/game-sdk/play";
import { createRunLoop } from "@frostbite/game-sdk/run-loop";
import { attachTapToStart } from "@frostbite/game-sdk/touch-start";

import { effects, track } from "./audio.ts";
import { guide } from "./guide.ts";
import { pulseSounds } from "./feedback.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import { milestoneIds } from "./rules/milestones.ts";
import { startRun } from "./rules/state.ts";
import { attachControls } from "./screen/controls.ts";
import { canvasScale, draw, screenHeight, screenWidth } from "./screen/draw.ts";
import type { View } from "./screen/view.ts";
import { createPulseSession, type PulseSession } from "./session.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the network.
// The rules, the session and the screen are in their own modules; this only joins them to the page and the platform.
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
// The first-screen card is drawn over the screen at the pixels of the display, so it stays sharp when the small screen is scaled up.
const guideLayer = createGuideLayer(screen);
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: PulseSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let heldNote = "";
let earnedCount = 0;
// The idle screen's field.
const backdrop = startRun(1);
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

function show(): void {
  if (context === null) return;
  draw(context, session?.state() ?? backdrop, view);
  guideLayer.show(view.phase === "ready" ? guide : null);
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
}

const loop = createRunLoop({
  frame(ticks) {
    const current = session;
    if (current === null) return false;
    for (let at = 0; at < ticks && !current.state().ended; at += 1) {
      const before = current.state();
      current.tick();
      for (const name of pulseSounds(before, current.state())) sound.sfx(name);
    }
    show();
    if (!current.state().ended) return true;
    void finish(current);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    setText(note, pauseCopy.paused);
    return;
  }
  setText(note, heldNote);
});

async function finish(finished: PulseSession): Promise<void> {
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
  await sendRun(play, runId, record);
}

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    setText(note, "Tap each note as it meets the line.");
    session = createPulseSession({
      onEarned: (id) => {
        sound.sfx("milestone");
        addEarned(id);
        view = {
          ...view,
          toast: {
            text: titles.get(id) ?? id,
            until: (session?.state().tick ?? 0) + 150,
          },
        };
        play?.report(id);
      },
      seed: ready?.seed ?? localSeed(),
    });
    earnedCount = 0;
    earnedList.replaceChildren();
    setText(countOut, "0");
    view = { ...view, newBest: false, phase: "running", toast: null };
    setRunning(true);
    sound.sfx("start");
    sound.music(true);
  });

// A lane is tapped. With a run going it is a tap on the tick the run is at; with none, nothing happens (Enter or the button start a run).
function lane(which: number): void {
  if (!loop.active()) return;
  const current = session;
  if (current === null) return;
  const before = current.state();
  if (!current.press(which).ok) return;
  for (const name of pulseSounds(before, current.state())) sound.sfx(name);
  show();
}

function startFromKey(): void {
  if (!startButton.disabled && !loop.running()) void begin();
}

function togglePause(): void {
  if (loop.running()) pause.toggle();
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
attachControls(screen, { lane, pause: togglePause, start: startFromKey });
pauseButton.addEventListener("click", togglePause);
attachTapToStart(screen, startButton);
startButton.addEventListener("click", () => void begin());
setRunning(false);
show();
void connect();
