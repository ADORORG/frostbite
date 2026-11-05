import { createGuideLayer } from "@ador/game-sdk/guide-layer";
import { setUpSound } from "@ador/game-sdk/audio/setup";
import { createGameClient, GameHostError } from "@ador/game-sdk/client";
import { createPause, pauseCopy } from "@ador/game-sdk/pause";
import { connectToPlatform, type PlatformPlay } from "@ador/game-sdk/play";
import { createRunLoop } from "@ador/game-sdk/run-loop";
import {
  startNote,
  submitNote,
  type SubmitState,
} from "@ador/game-sdk/run-notes";

import { effects, perfectSound, track } from "./audio.ts";
import { dropSounds, tempoScale, type DropSound } from "./feedback.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { cameraTarget, easeCamera } from "./screen/camera.ts";
import { attachControls } from "./screen/controls.ts";
import { draw } from "./screen/draw.ts";
import { screenHeight, screenWidth } from "./screen/layout.ts";
import { guide } from "./guide.ts";
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
// The first-screen card is drawn over the screen at the pixels of the display, so it stays sharp when the small screen is scaled up.
const guideLayer = createGuideLayer(screen);
const heightOut = element("height", "strong");
const streakOut = element("streak", "strong");
const bestOut = element("best", "strong");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const dropButton = element("drop", "button");
const pauseButton = element("pause", "button");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
// What the screen shows before a first run: the first block, waiting. It is never played and never recorded.
const waiting = createRunSession({ seed: 1 });
let runId: string | null = null;
let titles = new Map<string, string>();
let camera = 0;
let heldNote = "";
// Frames drawn after a run ends, so the block that missed can be seen falling away; a new run ends them.
let falling = 0;
const fallFrames = 45;

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

function show(after = 0): void {
  const shown = session ?? waiting;
  const state = shown.state();
  heightOut.textContent = String(state.height);
  streakOut.textContent = String(state.streak);
  bestOut.textContent = String(progress.best);
  if (context === null) return;
  camera = easeCamera(camera, cameraTarget(shown.slabs().length));
  draw(context, {
    camera,
    clock: shown.clock() + after,
    cut: shown.cut(),
    movingX: shown.movingX(),
    slabs: shown.slabs(),
    state,
  });
  guideLayer.show(session === null ? guide : null);
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
  dropButton.disabled = !running;
  pauseButton.disabled = !running;
}

function hear(heard: DropSound): void {
  if (heard.kind === "perfect") sound.play(perfectSound(heard.streak));
  else sound.sfx(heard.kind);
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

function fall(token: number, frames: number): void {
  if (token !== falling) return;
  show(frames);
  if (frames < fallFrames) requestAnimationFrame(() => fall(token, frames + 1));
}

async function finish(finished: RunSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  falling += 1;
  fall(falling, 0);
  const record = finished.record();
  progress = withBest(progress, finished.state().height);
  saveProgress();
  startButton.textContent = "Run again";
  if (runId === null || play === null) {
    note.textContent = submitNote(null);
    return;
  }
  const sent = runId;
  note.textContent = submitNote({ kind: "pending" });
  const settled: SubmitState = await play.runs.submit(sent, record).then(
    (result) => ({ kind: "settled", result }) as const,
    () => ({ kind: "failed" }) as const,
  );
  note.textContent = submitNote(settled);
}

function drop(): void {
  const running = session;
  if (running === null || !loop.active()) return;
  const before = running.state();
  running.drop();
  const after = running.state();
  for (const heard of dropSounds(before, after)) hear(heard);
  sound.tempo(tempoScale(after.height));
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
    note.textContent = startNote(
      started ?? null,
      "Tap the screen (or press space) to drop the block. Land it on the tower: what hangs over is cut off.",
    );
    session = createRunSession({
      onEarned: (id) => {
        sound.sfx("milestone");
        play?.report(id);
      },
      seed: ready?.seed ?? localSeed(),
    });
    listEarned([]);
    setRunning(true);
    falling += 1;
    camera = 0;
    sound.tempo(1);
    sound.sfx("start");
    sound.music(true);
  });

// Enter starts a run, and drops the block once one is going, as it always has.
function enter(): void {
  if (loop.running()) drop();
  else if (!startButton.disabled) void begin();
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
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
  drop,
  pause: () => void (loop.running() && pause.toggle()),
  start: enter,
});
dropButton.addEventListener("click", drop);
pauseButton.addEventListener(
  "click",
  () => void (loop.running() && pause.toggle()),
);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
