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

import { effects, track } from "./audio.ts";
import { worldSounds } from "./feedback.ts";
import { metres } from "./rules/milestones.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { draw, screenHeight, screenWidth } from "./screen/draw.ts";
import { attachControls } from "./screen/controls.ts";
import { ticksPerSecond } from "./rules/constants.ts";
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
const distance = element("distance", "strong");
const shards = element("shards", "strong");
const bestOut = element("best", "strong");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const jumpButton = element("jump", "button");
const slideButton = element("slide", "button");
const pauseButton = element("pause", "button");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
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
  const state = session?.state();
  distance.textContent = String(state === undefined ? 0 : metres(state));
  shards.textContent = String(state?.shardsTaken ?? 0);
  bestOut.textContent = String(progress.best);
  if (context !== null && state !== undefined)
    draw(context, state, progress.best);
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
  jumpButton.disabled = !running;
  slideButton.disabled = !running;
  pauseButton.disabled = !running;
}

const loop = createRunLoop({
  frame(ticks) {
    const current = session;
    if (current === null) return false;
    const before = current.state();
    for (let at = 0; at < ticks && !current.state().ended; at += 1)
      current.tick();
    for (const name of worldSounds(before, current.state())) sound.sfx(name);
    listEarned(current.earned());
    show();
    if (!current.state().ended) return true;
    void finish(current);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

function act(move: "jump" | "slide"): void {
  if (loop.active() && session?.[move]().ok === true) sound.sfx(move);
}

function togglePause(): void {
  if (loop.running()) pause.toggle();
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
    return;
  }
  note.textContent = heldNote;
});

async function finish(finished: RunSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  sound.sfx("hit");
  const record = finished.record();
  progress = withBest(progress, metres(finished.state()));
  saveProgress();
  show();
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

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    note.textContent = startNote(
      started ?? null,
      "Tap the top of the screen (or press space) to jump, the bottom (or the down key) to slide.",
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
    sound.sfx("start");
    sound.music(true);
  });

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
  jump: () => act("jump"),
  pause: togglePause,
  slide: () => act("slide"),
  start: () => void (!startButton.disabled && begin()),
});
jumpButton.addEventListener("click", () => act("jump"));
slideButton.addEventListener("click", () => act("slide"));
pauseButton.addEventListener("click", togglePause);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
