import { createGameClient, GameHostError } from "@ador/game-sdk/client";

import { earned, restore, tap, type GameState } from "./game.ts";

// The page of the game: it draws, it plays, and it asks the platform to remember. It saves nothing itself and
// asks nothing of the network.
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
const score = element("score", "strong");
const tapButton = element("tap", "button");
const probeButton = element("probe", "button");
const unlocked = element("unlocked", "ul");
const probeResult = element("probe-result", "pre");

let state: GameState = restore(null);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function show(): void {
  score.textContent = String(state.score);
}

async function showUnlocked(): Promise<void> {
  const milestones = await client.milestones.list();
  unlocked.replaceChildren(
    ...milestones
      .filter(({ status: milestone }) => milestone === "unlocked")
      .map(({ id, title }) => {
        const item = document.createElement("li");
        item.dataset.milestone = id;
        item.textContent = title;
        return item;
      }),
  );
}

// Saves are batched to one a second, well inside what the platform allows.
function scheduleSave(): void {
  if (saveTimer !== undefined) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void client.progress.save({ score: state.score });
  }, 1_000);
}

async function start(): Promise<void> {
  try {
    await client.ready();
    state = restore(await client.progress.load());
    show();
    await showUnlocked();
    status.textContent = "Connected. Tap to score.";
    tapButton.disabled = false;
  } catch (error) {
    status.textContent =
      error instanceof GameHostError
        ? `The platform said: ${error.code}`
        : "Could not connect to the platform.";
  }
}

tapButton.addEventListener("click", () => {
  state = tap(state);
  show();
  scheduleSave();
  for (const id of earned(state))
    void client.milestones.unlock(id).then(showUnlocked);
});

// A check, for the platform's own tests, that this page really is cut off: it tries what a game must not be
// able to do and reports what happened.
probeButton.addEventListener("click", () => {
  const attempt = async (name: string, action: () => unknown) => {
    try {
      await action();
      return `${name}: allowed`;
    } catch {
      return `${name}: blocked`;
    }
  };
  void Promise.all([
    attempt("fetch", () => fetch("/api/v1/platform")),
    attempt("localStorage", () => localStorage.getItem("x")),
    attempt("cookie", () => document.cookie.length),
  ]).then((lines) => {
    probeResult.textContent = lines.join("\n");
  });
});

void start();
