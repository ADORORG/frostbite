import { setUpSound } from "@frostbite/game-sdk/audio/setup";
import { createPause, pauseCopy } from "@frostbite/game-sdk/pause";
import { createRunLoop } from "@frostbite/game-sdk/run-loop";
import { isTouchScreen } from "@frostbite/game-sdk/touch";
import { attachTapToStart } from "@frostbite/game-sdk/touch-start";

import { effects, track, type EffectName } from "./audio.ts";
import { createFrameClock } from "./frame-clock.ts";
import { keepTaps, page, stopAtButtons } from "./page.ts";
import { createPlatform } from "./platform.ts";
import { ticksPerSecond } from "./rules/constants.ts";
import { leads } from "./rules/leads.ts";
import type { RunState } from "./rules/types.ts";
import { createRunSession, type RunSession } from "./session.ts";
import { attachControls } from "./ui/controls.ts";
import { createFirstCard, guide, heroFrame } from "./ui/guide-card.ts";
import { createHud } from "./ui/hud.ts";
import { createResult } from "./ui/result.ts";
import { createSelect } from "./ui/select.ts";
import { createShare } from "./ui/share.ts";
import { createWatch } from "./ui/watch.ts";
import { createView, flatView, type GameView } from "./view.ts";
import { words } from "./words.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and asks nothing of the network.
// The rules, the session, the screen and the panels are in their own modules; this only joins them to the page and the platform.
type Phase = "loading" | "select" | "running" | "over";
const platform = createPlatform();
const touch = isTouchScreen();
const clock = createFrameClock(
  window.location.search,
  document.documentElement.dataset.fixed,
);

let phase: Phase = "loading";
let chosen = 0;
let session: RunSession | null = null;
let before: RunState | null = null;
let earnedNow: string[] = [];
let view: GameView | null = null;
// A start asked for while the screen was still being made, kept until it is.
let queued = false;
let pendingTick: ((time: number) => void) | null = null;
let ticked = 0;
let resultTimer = 0;

const pause = createPause();
const sound = setUpSound({
  container: page.sound,
  effects,
  pause,
  save: platform.keepSound,
  track,
});
const hud = createHud(document, page.stage);
const guideLayer = createFirstCard(page.screen, page.select, touch);

function showChosen(): void {
  select.show(chosen);
  view?.select(chosen);
}
const choose = (index: number): void => {
  if (phase !== "select") return;
  chosen = (index + leads.length) % leads.length;
  showChosen();
  sound.sfx("select");
};
const turn = (step: number): void => choose(chosen + step);
const select = createSelect(page.select, {
  play: () => void begin(),
  turn,
});
const shareWindow = createShare(page.share);
const result = createResult(page.result, {
  again: () => void begin(),
  change: () => toSelect(),
  share: () => {
    if (session !== null && view !== null)
      void shareWindow.open(session.state(), view.snapshot());
  },
});

const controls = attachControls(page.stage, page.main, {
  mode: () =>
    phase === "running" ? "play" : phase === "select" ? "select" : "wait",
  pause: () => void (loop.running() && pause.toggle()),
  ready: () => {
    const state = session?.state();
    return state === undefined
      ? { grow: false, vision: false }
      : {
          grow: state.tick >= state.player.growReady,
          vision: state.tick >= state.player.visionReady,
        };
  },
  start: () => void begin(),
  turn,
});
const watch = createWatch({
  controls,
  hud,
  sfx: (name) => sound.sfx(name),
  stage: page.stage,
});

// The run's ticks come from the SDK's loop, asked for from inside this page's own frame (below), so the hands are read before the ticks
// that use them and the picture is drawn after.
const loop = createRunLoop({
  frame(ticks) {
    const running = session;
    if (running === null) return false;
    for (let at = 0; at < ticks && !running.state().ended; at += 1) {
      before = running.state();
      running.tick();
      ticked += 1;
    }
    if (!running.state().ended) return true;
    void finish(running);
    return false;
  },
  now: clock.now,
  page: document,
  pause,
  request: (callback) => {
    pendingTick = callback;
  },
  ticksPerSecond,
});

function setRunning(running: boolean): void {
  page.start.hidden = running;
  page.pause.disabled = !running;
  page.main.classList.toggle("running", running);
}

pause.subscribe((paused) => {
  page.pause.textContent = paused ? pauseCopy.resume : pauseCopy.pause;
  page.note.textContent = paused ? pauseCopy.paused : "";
  page.stage.classList.toggle("paused", paused);
  clock.restart();
});

function onEarned(id: string): void {
  const title = platform.titleOf(id);
  sound.sfx("milestone");
  platform.report(id);
  earnedNow.push(title);
  hud.toast(title);
  const item = document.createElement("li");
  item.dataset.milestone = id;
  item.textContent = title;
  page.earned.append(item);
}

async function begin(): Promise<void> {
  if (page.start.disabled || page.start.hidden || loop.running()) return;
  const screen = view;
  queued = screen === null;
  if (screen === null) return;
  await loop.launch(async () => {
    const next = createRunSession({ onEarned, seed: await platform.start() });
    next.choose(chosen);
    session = next;
    before = next.state();
    earnedNow = [];
    page.earned.replaceChildren();
    screen.begin(chosen);
    phase = "running";
    window.clearTimeout(resultTimer);
    guideLayer.show(null);
    page.main.classList.remove("choosing");
    result.show(null);
    shareWindow.close();
    hud.reset();
    controls.forRound(0);
    setRunning(true);
    page.note.textContent = words.goal;
    window.setTimeout(() => {
      if (phase === "running" && !pause.paused()) page.note.textContent = "";
    }, 5000);
    sound.sfx("start");
    sound.music(true);
    clock.restart();
  });
}

async function finish(finished: RunSession): Promise<void> {
  phase = "over";
  page.pause.disabled = true;
  page.main.classList.remove("running");
  sound.music(false);
  const state = finished.state();
  sound.sfx(state.won ? "win" : "lose");
  const newBest = platform.settle(state.score);
  page.best.textContent = String(platform.best());
  const shown = {
    best: platform.best(),
    earned: [...earnedNow],
    newBest,
    state,
  };
  // The result waits a moment, so the hero's win or slump is seen first, and only then is a new run on offer.
  resultTimer = window.setTimeout(() => {
    page.start.textContent = words.playAgain;
    page.start.hidden = false;
    result.show(shown);
  }, 1400);
  await platform.send(finished.record());
}

function toSelect(): void {
  if (loop.running()) return;
  phase = "select";
  session = null;
  before = null;
  window.clearTimeout(resultTimer);
  page.start.hidden = false;
  page.start.textContent = words.startRun;
  result.show(null);
  shareWindow.close();
  page.stage.classList.remove("frosted");
  page.main.classList.add("choosing");
  guideLayer.show(guide);
  showChosen();
}

// Each animation frame: the hands to the run, the run's ticks, then the readouts and the picture.
function animate(real: number): void {
  requestAnimationFrame(animate);
  const { dt, time } = clock.frame(real);
  controls.poll();
  if (session !== null && loop.active())
    session.hands(controls.way(), controls.buttons());
  const tickNow = pendingTick;
  pendingTick = null;
  if (tickNow !== null) {
    ticked = 0;
    tickNow(time);
    clock.ticked(ticked, time);
  }
  const now = session?.state();
  if (now !== undefined && phase !== "select") watch(now, phase === "running");
  if (clock.fixed) document.body.dataset.tick = String(now?.tick ?? -1);
  view?.show(
    dt,
    now === undefined || phase === "select"
      ? null
      : { before: before ?? now, now, share: clock.share() },
  );
}

async function connect(): Promise<void> {
  page.status.textContent = await platform.connect(sound.apply);
  page.best.textContent = String(platform.best());
  page.start.disabled = false;
}

async function boot(): Promise<void> {
  page.start.addEventListener("click", () => void begin());
  page.pause.addEventListener(
    "click",
    () => void (loop.running() && pause.toggle()),
  );
  // On a touch screen a tap on the screen starts a run; a tap on a panel's buttons is the button's own.
  attachTapToStart(page.stage, page.start);
  stopAtButtons(page.select, page.result);
  keepTaps(page.share);
  setRunning(false);
  page.start.disabled = true;
  page.main.classList.add("choosing");
  showChosen();
  guideLayer.show(guide);
  const connecting = connect();
  const parts = {
    canvas: page.screen,
    moment: {
      flash: hud.crystalFlash,
      sfx: (name: EffectName) => sound.sfx(name),
      shot: () => undefined,
    },
    ratio: () => Math.min(2, window.devicePixelRatio || 1),
    room: () => heroFrame(page.screen, page.select, touch),
    touch,
  };
  const made = await createView(parts).catch(() => flatView(parts));
  view = made;
  if (typeof ResizeObserver === "function")
    new ResizeObserver(() => made.resize()).observe(page.stage);
  if (!made.depth) page.note.textContent = words.flat;
  phase = "select";
  showChosen();
  page.stage.classList.add("ready");
  requestAnimationFrame(animate);
  await connecting;
  if (queued) void begin();
}

void boot();
