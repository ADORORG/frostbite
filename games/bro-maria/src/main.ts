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

import { effects, track } from "./audio.ts";
import { worldSounds } from "./feedback.ts";
import {
  freshProgress,
  restore,
  withBest,
  withSound,
  type Progress,
} from "./progress.ts";
import { stages, ticksPerSecond } from "./rules/constants.ts";
import { coinsTaken } from "./rules/milestones.ts";
import { scoreOf } from "./score.ts";
import { draw, screenHeight, screenWidth } from "./screen/draw.ts";
import { attachHands } from "./screen/controls.ts";
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
const scoreOut = element("score", "strong");
const coinsOut = element("coins", "strong");
const livesOut = element("lives", "strong");
const stageOut = element("stage", "strong");
const stagesOut = element("stages", "span");
const earnedList = element("earned", "ul");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const pad = element("pad", "div");
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let heldNote = "";

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

// What the screen shows before a first run: the start of the level, with the guide over it. It is never played and never recorded.
const waiting = createRunSession({ seed: 1 });

function show(): void {
  const state = session?.state();
  scoreOut.textContent = String(state === undefined ? 0 : scoreOf(state));
  coinsOut.textContent = String(state === undefined ? 0 : coinsTaken(state));
  livesOut.textContent = String(state?.lives ?? 3);
  stageOut.textContent = String(state?.stage ?? 1);
  if (context === null) return;
  draw(context, state ?? waiting.state());
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
  pauseButton.disabled = !running;
  for (const button of pad.querySelectorAll("button"))
    button.disabled = !running;
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});

async function finish(finished: RunSession): Promise<void> {
  setRunning(false);
  sound.music(false);
  const record = finished.record();
  progress = withBest(progress, scoreOf(finished.state()));
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

const loop = createRunLoop({
  frame(ticks) {
    const current = session;
    if (current === null) return false;
    for (let at = 0; at < ticks && !current.state().ended; at += 1) {
      const before = current.state();
      current.tick();
      for (const name of worldSounds(before, current.state())) sound.sfx(name);
    }
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

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    note.textContent = startNote(
      started ?? null,
      "Run with the arrow keys or A and D, jump with space or up. Six stages, each harder: reach the lantern at the end of each.",
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

stagesOut.textContent = String(stages);
screen.width = screenWidth;
screen.height = screenHeight;
// The controls are let go of and held even while paused, so a key let go of during a pause is not held on resume.
attachHands(document.body, {
  hold: (control, on) => void session?.hold(control, on),
  pause: () => void (loop.running() && pause.toggle()),
  start: () => void (!startButton.disabled && begin()),
});
pauseButton.addEventListener(
  "click",
  () => void (loop.running() && pause.toggle()),
);
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
