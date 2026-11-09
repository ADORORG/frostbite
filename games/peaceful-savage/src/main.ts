import { setUpSound } from "@frostbite/game-sdk/audio/setup";
import {
  finishRun,
  freshProgress,
  restore,
  withSound,
  type Progress,
} from "@frostbite/game-sdk/best-progress";
import { createGameClient, GameHostError } from "@frostbite/game-sdk/client";
import { createPause, pauseCopy } from "@frostbite/game-sdk/pause";
import {
  connectToPlatform,
  type PlatformPlay,
  sendRun,
} from "@frostbite/game-sdk/play";
import { createRunLoop } from "@frostbite/game-sdk/run-loop";
import { byInput } from "@frostbite/game-sdk/touch";
import { restartDelayMs } from "@frostbite/game-sdk/touch-start";

import { effects, track } from "./audio.ts";
import { soundOf } from "./feedback.ts";
import { guide } from "./guide.ts";
import { attachButtons, noteFor, type Phase } from "./page/buttons.ts";
import { createCardPanel } from "./page/card-panel.ts";
import { createCardMaker } from "./page/cards.ts";
import { createEnding } from "./page/ending.ts";
import { createStageHands } from "./page/stage-hands.ts";
import { attachKeyboard, attachTouch, type Hands } from "./page/controls.ts";
import { element } from "./page/elements.ts";
import { createHud, showEarned } from "./page/hud.ts";
import { createMomentPanel } from "./page/moment.ts";
import { createOverlay } from "./page/overlay.ts";
import { type Play, startPlay } from "./page/run.ts";
import { createScreen } from "./page/screen.ts";
import { createSelect } from "./page/select.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import { stepOf } from "./rules/moment.ts";
import { startRun } from "./rules/state.ts";
import type { News, PlayState } from "./rules/types.ts";
import { resultOf } from "./screen/result.ts";

// The page of the game: it shows the family's home in three dimensions (or, where there is no WebGL 2, a flat map), lets the player choose
// who leads and play, makes share cards at the story's turning points, and asks the platform to remember. It saves nothing itself and
// asks nothing of the network. The rules, the session, the view and the page's parts are in their own modules; this only joins them.
const client = createGameClient();
const main = element("main", "main");
const status = element("status", "p");
const note = element("note", "p");
const earnedList = element("earned", "ul");
const now = (): number => performance.now();

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let current: Play | null = null;
let phase: Phase = "ready";
let newBest = false;
let runId: string | null = null;
let titles = new Map<string, string>();
let offeredSince = Number.POSITIVE_INFINITY;
let tickedAt = now();
// What is shown before a first run: the family on the lawn, waiting to be chosen. It is never played and never recorded.
const waiting = startRun(1);

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

const running = (): boolean => phase === "running" && current !== null;
const shownState = (): PlayState => current?.state() ?? waiting;

const select = createSelect();
const overlay = createOverlay(() => byInput("E", "Tap"));
const cards = createCardMaker();
const cardPanel = createCardPanel();
const screen = createScreen({
  cards,
  hud: createHud((skill) => current?.practise(skill)),
  moment: createMomentPanel((option) => current?.choose(option)),
  onCard: () => {
    buttons.offerCards(true);
  },
  overlay,
  select,
});

function hear(news: News): void {
  const effect = soundOf(news.kind);
  if (effect !== null) sound.sfx(effect);
  overlay.hear(news, now());
  cards.hear(news, shownState(), now());
}

function setPhase(next: Phase): void {
  phase = next;
  main.dataset.phase = next;
  buttons.show(next);
  select.show(next === "choosing");
  if (next !== "running") offeredSince = now();
  note.textContent = noteFor(next);
}

const animate = (): void => {
  const time = now();
  const state = shownState();
  screen.draw({
    alpha: running()
      ? Math.min(1, ((time - tickedAt) * ticksPerSecond) / 1000)
      : 1,
    best: progress.best,
    card:
      phase === "ready"
        ? guide
        : phase === "over"
          ? resultOf(state, progress.best, newBest)
          : null,
    previous: current?.previous() ?? state,
    running: running(),
    stage: show.frame(time),
    state,
    time,
  });
  if ("requestAnimationFrame" in globalThis) requestAnimationFrame(animate);
};

pause.subscribe((paused) => {
  element("pause", "button").textContent = paused
    ? pauseCopy.resume
    : pauseCopy.pause;
  note.textContent = paused ? pauseCopy.paused : noteFor(phase);
});

const loop = createRunLoop({
  frame(ticks) {
    const run = current;
    if (run === null) return false;
    run.tick(ticks);
    if (ticks > 0) tickedAt = now();
    if (!run.state().ended) return true;
    void finish(run);
    return false;
  },
  page: document,
  pause,
  ticksPerSecond,
});

// The card after a run, once its end has played out (at once, for a run the player ended); in the show, the player moves the family.
const ending = createEnding(
  () => void setPhase("over"),
  (cue) => void sound.sfx(cue),
);
const show = createStageHands(() => phase === "ending", now);

async function finish(run: Play): Promise<void> {
  if (pause.paused()) pause.set(false);
  sound.music(false);
  const state = run.state();
  const done = finishRun(progress, state.score);
  progress = done.progress;
  newBest = done.newBest;
  setPhase(ending.begin(state.cause) ? "ending" : "over");
  show.begin(state.lead ?? select.chosen());
  saveProgress();
  element("start", "button").textContent = "Go again";
  await sendRun(play, runId, run.record());
}

const begin = (): Promise<void> =>
  loop.launch(async () => {
    const started = await play?.runs.start().catch(() => null);
    const ready = started?.status === "started" ? started : null;
    runId = ready?.runId ?? null;
    const earned: string[] = [];
    cards.clear();
    buttons.offerCards(false);
    current = startPlay({
      hero: select.chosen(),
      onEarned: (id) => {
        sound.sfx("milestone");
        play?.report(id);
        earned.push(id);
        showEarned(earnedList, titles, earned);
      },
      onNews: hear,
      seed: ready?.seed ?? Math.floor(Math.random() * 0x1_0000_0000),
    });
    newBest = false;
    tickedAt = now();
    showEarned(earnedList, titles, []);
    setPhase("running");
    sound.sfx("start");
    sound.music(true);
  });

function start(): void {
  if (cardPanel.isOpen()) return;
  if (phase === "ending") return ending.skip();
  if (phase === "running" || element("start", "button").disabled) return;
  void begin();
}

function turn(by: number): void {
  if (phase === "running" || phase === "ending" || cardPanel.isOpen()) return;
  if (phase === "choosing") select.turn(by);
  else setPhase("choosing");
}

// While the share cards are open, the keys and the screen leave the game alone.
const playing = (): boolean =>
  running() && loop.active() && !cardPanel.isOpen();
const hands: Hands = {
  act: (down) => {
    if (playing()) current?.act(down);
  },
  cards: () => {
    if (cards.cards().length === 0) return;
    if (running() && !pause.paused()) pause.set(true);
    cardPanel.open(cards.cards());
  },
  choose: (option) => {
    if (playing()) current?.choose(option);
  },
  choosing: () => stepOf(shownState())?.kind === "choose",
  end: () => {
    const run = current;
    if (!running() || run === null) return;
    run.end();
    loop.stop();
    void finish(run);
  },
  inMoment: () => shownState().moment !== null,
  pause: () => void (loop.running() && pause.toggle()),
  practise: (skill) => {
    if (playing()) current?.practise(skill);
  },
  running,
  start,
  steer: (push, fast) => {
    if (running()) current?.steer(push, screen.forward(), fast);
  },
  turn,
  vision: () => {
    if (playing()) current?.vision();
  },
};

attachKeyboard(show.wrap(hands, false));
const buttons = attachButtons(hands);
// A tap starts a run only once Start has been on offer for a moment, so the tap that ends a run does not begin the next.
const touched: Hands = {
  ...hands,
  start: () => {
    if (now() - offeredSince >= restartDelayMs) start();
  },
};
attachTouch(element("screen", "canvas"), main, show.wrap(touched, true));

async function connect(): Promise<void> {
  let connected: string;
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
    connected = "Connected.";
  } catch (error) {
    connected =
      error instanceof GameHostError
        ? `The platform said: ${error.code}`
        : "Could not connect to the platform. You can still play.";
  }
  status.textContent = screen.build()
    ? connected
    : `${connected} This device has no WebGL 2, so you play on a map.`;
  buttons.start.disabled = false;
  setPhase(phase);
}

setPhase("ready");
buttons.start.disabled = true;
animate();
void connect();
