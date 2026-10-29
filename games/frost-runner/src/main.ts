import { createGameClient, GameHostError } from "@ador/game-sdk/client";
import { connectToPlatform, type PlatformPlay } from "@ador/game-sdk/play";
import {
  startNote,
  submitNote,
  type SubmitState,
} from "@ador/game-sdk/run-notes";

import { metres } from "./rules/milestones.ts";
import { freshProgress, restore, withBest, type Progress } from "./progress.ts";
import { draw, screenHeight, screenWidth } from "./screen/draw.ts";
import { attachControls } from "./screen/controls.ts";
import { ticksIn } from "./screen/clock.ts";
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
const context = screen.getContext("2d");

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: RunSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();
let carried = 0;
let last = 0;

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
}

async function finish(finished: RunSession): Promise<void> {
  setRunning(false);
  const record = finished.record();
  progress = withBest(progress, metres(finished.state()));
  void client.progress.save({ best: progress.best });
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

function frame(now: number): void {
  const running = session;
  if (running === null) return;
  const step = ticksIn(carried, now - last);
  carried = step.carried;
  last = now;
  for (let at = 0; at < step.ticks && !running.state().ended; at += 1)
    running.tick();
  listEarned(running.earned());
  show();
  if (running.state().ended) void finish(running);
  else requestAnimationFrame(frame);
}

async function begin(): Promise<void> {
  const started = await play?.runs.start().catch(() => null);
  const ready = started?.status === "started" ? started : null;
  runId = ready?.runId ?? null;
  note.textContent = startNote(
    started ?? null,
    "Tap the top of the screen (or press space) to jump, the bottom (or the down key) to slide.",
  );
  session = createRunSession({
    onEarned: (id) => play?.report(id),
    seed: ready?.seed ?? localSeed(),
  });
  listEarned([]);
  setRunning(true);
  carried = 0;
  last = performance.now();
  requestAnimationFrame(frame);
}

async function connect(): Promise<void> {
  try {
    await client.ready();
    progress = restore(await client.progress.load());
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
  jump: () => void session?.jump(),
  slide: () => void session?.slide(),
});
jumpButton.addEventListener("click", () => void session?.jump());
slideButton.addEventListener("click", () => void session?.slide());
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
