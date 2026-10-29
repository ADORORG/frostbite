import { createGameClient, GameHostError } from "@ador/game-sdk/client";
import { connectToPlatform, type PlatformPlay } from "@ador/game-sdk/play";
import {
  startNote,
  submitNote,
  type SubmitState,
} from "@ador/game-sdk/run-notes";

import { directions, type Direction } from "./rules/constants.ts";
import { freshProgress, restore, withBest, type Progress } from "./progress.ts";
import { attachControls } from "./screen/controls.ts";
import { showBoard } from "./screen/board-view.ts";
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

let play: PlatformPlay | null = null;
let progress: Progress = freshProgress;
let session: DropSession | null = null;
let runId: string | null = null;
let titles = new Map<string, string>();

const localSeed = (): number => Math.floor(Math.random() * 0x1_0000_0000);

function show(): void {
  const state = session?.state();
  showBoard(grid, state?.board ?? []);
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

function setRunning(running: boolean): void {
  startButton.textContent = session === null ? "Start run" : "New run";
  for (const button of pad.querySelectorAll("button"))
    button.disabled = !running;
}

async function finish(finished: DropSession): Promise<void> {
  setRunning(false);
  const record = finished.record();
  progress = withBest(progress, finished.state().score);
  void client.progress.save({ best: progress.best });
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
  if (running === null || running.state().over || running.state().ended) return;
  const outcome = running.move(direction);
  if (!outcome.ok) return;
  show();
  if (running.state().over) void finish(running);
}

async function begin(): Promise<void> {
  const started = await play?.runs.start().catch(() => null);
  const ready = started?.status === "started" ? started : null;
  runId = ready?.runId ?? null;
  note.textContent = startNote(
    started ?? null,
    "Slide the tiles with the arrow keys, WASD or a swipe. Equal tiles join.",
  );
  session = createDropSession({
    onEarned: (id) => play?.report(id),
    seed: ready?.seed ?? localSeed(),
  });
  setRunning(true);
  show();
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

attachControls(grid, choose);
for (const direction of directions)
  pad
    .querySelector(`[data-direction="${direction}"]`)
    ?.addEventListener("click", () => choose(direction));
startButton.addEventListener("click", () => void begin());
setRunning(false);
void connect();
