import { fillGuide } from "@ador/game-sdk/guide";
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

import { effects, joinSound, track } from "./audio.ts";
import { moveSound } from "./feedback.ts";
import { directions, type Direction } from "./rules/constants.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { attachControls } from "./screen/controls.ts";
import { showBoard } from "./screen/board-view.ts";
import { guide } from "./guide.ts";
import { createDropSession, type DropSession } from "./session.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the network.
// The rules, the session and the board's drawing are in their own modules; this only joins them to the page and the platform.
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
const grid = element("board", "div");
const score = element("score", "strong");
const moves = element("moves", "strong");
const bestOut = element("best", "strong");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const pad = element("pad", "div");
const pauseButton = element("pause", "button");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: DropSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let starting = false;
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

function show(previous: readonly number[] | null = null): void {
  const state = session?.state();
  showBoard(grid, state?.board ?? [], previous);
  score.textContent = String(state?.score ?? 0);
  moves.textContent = String(state?.moves ?? 0);
  bestOut.textContent = String(progress.best);
  earnedList.replaceChildren(
    ...(session?.earned() ?? []).map((id) => {
      const item = document.createElement("li");
      item.dataset.milestone = id;
      item.textContent = titles.get(id) ?? id;
      return item;
    }),
  );
}

const guideBox = element("guide", "div");
fillGuide(guideBox, guide);

function setRunning(running: boolean): void {
  if (running) guideBox.hidden = true;
  startButton.textContent = session === null ? "Start run" : "New run";
  for (const button of pad.querySelectorAll("button"))
    button.disabled = !running;
  pauseButton.disabled = !running;
}

const going = (): boolean =>
  session !== null && !session.state().over && !session.state().ended;

function togglePause(): void {
  if (going()) pause.toggle();
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && going()) pause.set(true);
});

async function finish(finished: DropSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  sound.sfx("lose");
  const record = finished.record();
  progress = withBest(progress, finished.state().score);
  saveProgress();
  show();
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

function choose(direction: Direction): void {
  const running = session;
  if (running === null || !going() || pause.paused()) return;
  const before = running.state();
  const outcome = running.move(direction);
  if (!outcome.ok) return;
  const heard = moveSound(before, running.state());
  if (heard.kind === "join") sound.play(joinSound(heard.biggest));
  else sound.sfx("slide");
  show(before.board);
  if (running.state().over) void finish(running);
}

async function begin(): Promise<void> {
  if (starting) return;
  starting = true;
  const started = await play?.runs.start().catch(() => null);
  const ready = started?.status === "started" ? started : null;
  runId = ready?.runId ?? null;
  note.textContent = startNote(
    started ?? null,
    "Slide the tiles with the arrow keys, WASD or a swipe. Equal tiles join.",
  );
  session = createDropSession({
    onEarned: (id) => {
      sound.sfx("milestone");
      play?.report(id);
    },
    seed: ready?.seed ?? localSeed(),
  });
  starting = false;
  pause.set(false);
  setRunning(true);
  sound.sfx("start");
  sound.music(true);
  show();
}

// Enter starts a run, but never throws away one that is going: that is the button's job, which says "New run".
const startFromKey = (): void => {
  if (!startButton.disabled && !going()) void begin();
};

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

attachControls(grid, {
  move: choose,
  pause: togglePause,
  start: startFromKey,
});
for (const direction of directions)
  pad
    .querySelector(`[data-direction="${direction}"]`)
    ?.addEventListener("click", () => choose(direction));
pauseButton.addEventListener("click", togglePause);
// The first-screen card lies over the board, so a tap lands on the stage the two share.
attachTapToStart(grid.parentElement ?? grid, startButton);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
