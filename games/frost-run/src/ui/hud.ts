import { perRound, roundCount, ticksPerSecond } from "../rules/constants.ts";
import { needed, totals } from "../rules/round.ts";
import type { ItemKind, RunState } from "../rules/types.ts";
import { kindWords, roundWords, words } from "../words.ts";

// What the player reads while a run goes: the round, the time left and this round's treasure in the bar along the top; and over the screen
// three meters of the whole run's treasure against the 90% the run needs, the powers and how soon each is back, a banner as each round
// opens, and a toast for each milestone. Only what changed is written, so the page does little work a frame.
const kinds: readonly ItemKind[] = ["crystal", "egg", "key"];

function find<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  type: new () => T,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing ${selector}`);
  return found;
}

export interface Hud {
  readonly banner: (title: string, line: string) => void;
  readonly toast: (text: string) => void;
  readonly update: (state: RunState) => void;
  // The one orange moment: a crystal taken. The screen's edge and the crystal count light up for a quarter of a second.
  readonly crystalFlash: () => void;
  readonly reset: () => void;
}

export function createHud(page: Document, stage: HTMLElement): Hud {
  const roundOut = find(page, "#round", HTMLElement);
  const timeOut = find(page, "#time", HTMLElement);
  const counts = {
    crystal: find(page, "#crystals", HTMLElement),
    egg: find(page, "#eggs", HTMLElement),
    key: find(page, "#keys", HTMLElement),
  };
  const meters = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      find(stage, `.gauge[data-kind="${kind}"]`, HTMLElement),
    ]),
  );
  const powers = [...stage.querySelectorAll<HTMLElement>(".power")];
  const bannerBox = find(stage, ".banner", HTMLElement);
  const toastBox = find(stage, ".toast", HTMLElement);
  const hud = find(stage, ".hud", HTMLElement);
  const flash = find(stage, ".flash", HTMLElement);
  const written = new Map<HTMLElement, string>();
  const write = (element: HTMLElement, text: string): void => {
    if (written.get(element) === text) return;
    written.set(element, text);
    element.textContent = text;
  };
  let bannerTimer = 0;
  let toastTimer = 0;
  let flashTimer = 0;
  let shownRound = -1;

  for (const kind of kinds) {
    const meter = meters[kind];
    const goal = meter?.querySelector<HTMLElement>(".goal");
    if (goal !== null && goal !== undefined)
      goal.style.left = `${String((needed(kind) / (perRound[kind] * roundCount)) * 100)}%`;
  }

  return {
    banner(title, line) {
      find(bannerBox, ".title", HTMLElement).textContent = title;
      find(bannerBox, ".line", HTMLElement).textContent = line;
      bannerBox.classList.remove("on");
      void bannerBox.offsetWidth;
      bannerBox.classList.add("on");
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(
        () => bannerBox.classList.remove("on"),
        2800,
      );
    },
    crystalFlash() {
      flash.classList.remove("on");
      void flash.offsetWidth;
      flash.classList.add("on");
      counts.crystal.parentElement?.classList.add("struck");
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => {
        flash.classList.remove("on");
        counts.crystal.parentElement?.classList.remove("struck");
      }, 260);
    },
    reset() {
      written.clear();
      shownRound = -1;
      hud.classList.add("on");
    },
    toast(text) {
      toastBox.textContent = text;
      toastBox.classList.remove("on");
      void toastBox.offsetWidth;
      toastBox.classList.add("on");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(
        () => toastBox.classList.remove("on"),
        2600,
      );
    },
    update(state) {
      const tally = state.tallies[state.round];
      write(roundOut, `${String(state.round + 1)}/3`);
      const seconds = Math.max(0, Math.ceil(state.timeLeft / ticksPerSecond));
      write(timeOut, state.phase === "play" ? `${String(seconds)}` : "—");
      timeOut.parentElement?.classList.toggle(
        "low",
        state.phase === "play" && seconds <= 10,
      );
      for (const kind of kinds)
        write(
          counts[kind],
          `${String(tally?.[kind] ?? 0)}/${String(perRound[kind])}`,
        );
      const sum = totals(state.tallies);
      for (const kind of kinds) {
        const meter = meters[kind];
        if (meter === undefined) continue;
        const of = perRound[kind] * roundCount;
        const fill = meter.querySelector<HTMLElement>(".fill");
        if (fill !== null)
          fill.style.width = `${String((sum[kind] / of) * 100)}%`;
        const label = meter.querySelector<HTMLElement>(".count");
        if (label !== null)
          write(label, `${String(sum[kind])}/${String(needed(kind))}`);
        meter.classList.toggle("met", sum[kind] >= needed(kind));
        meter.setAttribute(
          "aria-label",
          `${kindWords[kind].many} ${String(sum[kind])} of ${String(needed(kind))} needed`,
        );
      }
      const p = state.player;
      const tick = state.tick;
      for (const power of powers) {
        const name = power.dataset.power ?? "";
        const from = Number(power.dataset.round ?? "0");
        power.hidden = state.round < from;
        const ready =
          name === "grow"
            ? p.growReady
            : name === "vision"
              ? p.visionReady
              : name === "roll"
                ? p.rollReady
                : name === "shoot"
                  ? p.boltReady
                  : 0;
        const active =
          name === "grow"
            ? tick < p.growUntil
            : name === "vision"
              ? tick < p.visionUntil
              : false;
        const wait = Math.max(0, ready - tick);
        power.classList.toggle("wait", wait > 0 && !active);
        power.classList.toggle("active", active);
        power.style.setProperty(
          "--wait",
          wait > 0 ? String(Math.min(1, wait / 600)) : "0",
        );
      }
      if (state.round !== shownRound && state.phase === "play") {
        shownRound = state.round;
        const round = roundWords[state.round];
        if (round !== undefined)
          this.banner(
            `${words.round(state.round)} · ${round.name}`,
            round.learn,
          );
      }
    },
  };
}
