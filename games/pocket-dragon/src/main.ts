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

import { effects, tracks } from "./audio.ts";
import { chapterTitles } from "./chapters.ts";
import { instructions } from "./guide.ts";
import { element } from "./page/elements.ts";
import { attachHands, chapterOfKey } from "./page/hands.ts";
import { startRun, type ChapterRun } from "./page/runs.ts";
import { createView } from "./page/view.ts";
import {
  freshProgress,
  isOpen,
  restore,
  saved,
  withBest,
  withCleared,
  withPlasma,
  withSound,
  type Progress,
} from "./progress.ts";
import {
  chapterIds,
  ticksPerSecond,
  type ChapterId,
} from "./rules/constants.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the
// network. The rules, the sessions and the screen are in their own modules; this only joins them to the page and the platform.
const client = createGameClient();
const status = element("status", "p");
const note = element("note", "p");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const picker = element("chapters", "nav");
const view = createView();

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let chapter: ChapterId = "hills";
let run: ChapterRun | null = null;
let runId: string | null = null;
let titles: ReadonlyMap<string, string> = new Map();
let heldNote = "";

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

// What each chapter's screen shows before a run of it: the start of the chapter (just after its opening banner), with its guide over it.
// It is never played and never recorded.
const idleTicks = 150;
const idle = new Map<ChapterId, ChapterRun>();
function idleRun(id: ChapterId): ChapterRun {
  const found = idle.get(id);
  if (found !== undefined) return found;
  const made = startRun(id, 1);
  for (let at = 0; at < idleTicks; at += 1) made.tick();
  idle.set(id, made);
  return made;
}

function show(): void {
  const shown = run ?? idleRun(chapter);
  view.draw(shown, run === null, progress.best[shown.id], progress.plasma);
}

function showChapters(): void {
  view.chapters(chapter, progress, run !== null && !run.ended());
}

function choose(id: ChapterId): void {
  if (loop.running() || !isOpen(progress, id) || id === chapter) return;
  chapter = id;
  run = null;
  view.earned([], titles);
  note.textContent = "";
  showChapters();
  show();
}

pause.subscribe((paused) => {
  pauseButton.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  if (paused) {
    heldNote = note.textContent;
    note.textContent = pauseCopy.paused;
  } else note.textContent = heldNote;
});

// What clearing a chapter opens, said before what the platform said of the run.
function opened(finished: ChapterRun): string {
  if (!finished.cleared()) return "";
  const before = progress.unlocked;
  progress = withCleared(progress, finished.id);
  const next = chapterIds[chapterIds.indexOf(finished.id) + 1];
  if (next === undefined) return "You finished Glitchy's quest! ";
  if (progress.unlocked === before) return "";
  chapter = next;
  return `Chapter ${String(chapterIds.indexOf(next) + 1)} is open: ${chapterTitles[next]}! `;
}

async function finish(finished: ChapterRun): Promise<void> {
  view.running(false);
  sound.sound.stopMusic();
  const record = finished.record();
  progress = withPlasma(
    withBest(progress, finished.id, finished.score()),
    finished.plasma(),
  );
  const news = opened(finished);
  saveProgress();
  showChapters();
  show();
  startButton.textContent =
    finished.id === chapter ? "Play again" : "Start run";
  if (runId === null || play === null) {
    note.textContent = news + submitNote(null);
    return;
  }
  const sent = runId;
  note.textContent = news + submitNote({ kind: "pending" });
  const settled: SubmitState = await play.runs.submit(sent, record).then(
    (result) => ({ kind: "settled", result }) as const,
    () => ({ kind: "failed" }) as const,
  );
  note.textContent = news + submitNote(settled);
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

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    note.textContent = startNote(started ?? null, instructions[chapter]);
    run = startRun(chapter, ready?.seed ?? localSeed(), (id) => {
      sound.sfx("milestone");
      play?.report(id);
    });
    view.earned([], titles);
    view.running(true);
    showChapters();
    sound.sfx("start");
    sound.sound.playMusic(tracks[chapter]);
  });

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
    sound.apply(progress.sound);
    chapter = chapterIds[progress.unlocked - 1] ?? "hills";
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
  showChapters();
  show();
}

// The controls are let go of and held even while paused, so a key let go of during a pause is not held on resume.
attachHands(document.body, {
  // During a run every key goes to it; between runs, 1, 2 and 3 choose a chapter.
  hold(action, on) {
    if (loop.running()) run?.hold(action, on);
    const chapter = chapterOfKey(action);
    if (!loop.running() && on && chapter !== undefined) choose(chapter);
  },
  pause: () => void (loop.running() && pause.toggle()),
  start: () => void (!startButton.disabled && begin()),
});
picker.addEventListener("click", (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest("[data-chapter]")
      : null;
  const id = chapterIds.find(
    (name) => name === target?.getAttribute("data-chapter"),
  );
  if (id !== undefined) choose(id);
});
pauseButton.addEventListener(
  "click",
  () => void (loop.running() && pause.toggle()),
);
startButton.addEventListener("click", () => void begin());
view.running(false);
showChapters();
show();
void connect();
