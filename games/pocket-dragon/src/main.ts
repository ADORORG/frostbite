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
import { factsOf, type LastRun } from "./card/content.ts";
import { instructions } from "./guide.ts";
import { createCardPanel } from "./page/card-panel.ts";
import { element } from "./page/elements.ts";
import { attachHands, playOfKey } from "./page/hands.ts";
import { startQuestRun } from "./page/quest-run.ts";
import { startRun, type PlayRun } from "./page/runs.ts";
import { settle } from "./page/settle.ts";
import { createView } from "./page/view.ts";
import {
  freshProgress,
  isOpen,
  restore,
  saved,
  withSound,
  type Progress,
} from "./progress.ts";
import {
  playIds,
  ticksPerSecond,
  type ChapterId,
  type PlayId,
} from "./rules/constants.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the
// network. The rules, the sessions and the screen are in their own modules; this only joins them to the page and the platform.
const client = createGameClient();
const status = element("status", "p");
const note = element("note", "p");
const startButton = element("start", "button");
const pauseButton = element("pause", "button");
const picker = element("chapters", "nav");
const shareButton = element("share", "button");
const view = createView();

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let chosen: PlayId = "quest";
let run: PlayRun | null = null;
// The level last shown, so the touch buttons and the music change only when it does.
let shownLevel: ChapterId | null = null;
let runId: string | null = null;
let titles: ReadonlyMap<string, string> = new Map();
let heldNote = "";
// For the player's card: the last run, and the milestones the player is known to have (the platform's list, and what runs here earned).
let lastRun: LastRun | null = null;
const marks = new Set<string>();
const card = createCardPanel(() => shareButton.focus());

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

// What the quest's (and each level's) screen shows before a run: its start (just after the opening banner), with its guide over it. It
// is never played and never recorded.
const idleTicks = 150;
const idle = new Map<PlayId, PlayRun>();
const startPlay = (
  id: PlayId,
  seed: number,
  onEarned?: (milestone: string) => void,
): PlayRun =>
  id === "quest" ? startQuestRun(seed, onEarned) : startRun(id, seed, onEarned);
function idleRun(id: PlayId): PlayRun {
  const found = idle.get(id);
  if (found !== undefined) return found;
  const made = startPlay(id, 1);
  // Its counts are those of a run not yet begun (the quest's clock at nothing), though the screen is a little way in.
  const counts = made.stats();
  for (let at = 0; at < idleTicks; at += 1) made.tick();
  const shown: PlayRun = { ...made, stats: () => counts };
  idle.set(id, shown);
  return shown;
}

function show(): void {
  const shown = run ?? idleRun(chosen);
  const level = shown.level();
  if (level !== shownLevel) {
    shownLevel = level;
    view.level(level);
    if (run !== null && !run.ended()) sound.sound.playMusic(tracks[level]);
  }
  view.draw(shown, run === null, progress.best[shown.id], progress.plasma);
}

function showChapters(): void {
  view.chapters(chosen, progress, run !== null && !run.ended());
}

function choose(id: PlayId): void {
  if (loop.running() || !isOpen(progress, id) || id === chosen) return;
  chosen = id;
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

async function finish(finished: PlayRun): Promise<void> {
  view.running(false);
  sound.sound.stopMusic();
  const record = finished.record();
  const after = settle(progress, finished);
  const news = after.news;
  progress = after.progress;
  lastRun = after.lastRun;
  shareButton.classList.add("fresh");
  if (finished.id !== "quest" && after.opened !== null) chosen = after.opened;
  saveProgress();
  showChapters();
  view.fame(progress.fame);
  show();
  startButton.textContent = finished.id === chosen ? "Play again" : "Start run";
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
    note.textContent = startNote(started ?? null, instructions[chosen]);
    run = startPlay(chosen, ready?.seed ?? localSeed(), (id) => {
      sound.sfx("milestone");
      play?.report(id);
      marks.add(id);
    });
    view.earned([], titles);
    view.running(true);
    showChapters();
    sound.sfx("start");
    shownLevel = run.level();
    view.level(shownLevel);
    sound.sound.playMusic(tracks[shownLevel]);
  });

// The platform's list of the game's milestones, noting which the player has; asked again when the card opens, so a run just checked
// counts.
async function learnMarks() {
  const listed = await client.milestones.list().catch(() => []);
  for (const { id, status } of listed) if (status === "unlocked") marks.add(id);
  return listed;
}

function openCard(): void {
  if (loop.running()) return;
  shareButton.classList.remove("fresh");
  const facts = () =>
    factsOf(progress, lastRun, marks, titles, document.referrer);
  card.open(facts());
  void learnMarks().then(() => card.update(facts()));
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
    sound.apply(progress.sound);
    view.fame(progress.fame);
    play = await connectToPlatform(client);
    titles = new Map((await learnMarks()).map(({ id, title }) => [id, title]));
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
  // During a run every key goes to it; between runs, 0 chooses the whole quest and 1, 2 and 3 a level to practise.
  hold(action, on) {
    if (loop.running()) run?.hold(action, on);
    const pick = playOfKey(action);
    if (!loop.running() && !card.isOpen() && on && pick !== undefined)
      choose(pick);
  },
  pause: () => void (loop.running() && pause.toggle()),
  start: () => void (!startButton.disabled && !card.isOpen() && begin()),
});
picker.addEventListener("click", (event) => {
  const target =
    event.target instanceof Element
      ? event.target.closest("[data-chapter]")
      : null;
  const id = playIds.find(
    (name) => name === target?.getAttribute("data-chapter"),
  );
  if (id !== undefined) choose(id);
});
pauseButton.addEventListener(
  "click",
  () => void (loop.running() && pause.toggle()),
);
startButton.addEventListener("click", () => void begin());
shareButton.addEventListener("click", openCard);
view.running(false);
showChapters();
show();
void connect();
