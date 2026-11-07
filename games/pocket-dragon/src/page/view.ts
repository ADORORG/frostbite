import { cardFor, type Phase } from "@frostbite/game-sdk/card";
import type { ResultCard } from "@frostbite/game-sdk/guide";
import { createGuideLayer } from "@frostbite/game-sdk/guide-layer";

import { chapterTitles } from "../chapters.ts";
import { guides } from "../guide.ts";
import { isOpen, type FameEntry, type Progress } from "../progress.ts";
import { playIds, type PlayId } from "../rules/constants.ts";
import { clockOf } from "../score.ts";
import { drawTestMark } from "../screen/test-mark.ts";
import { createDepthView, type DepthView } from "../three/stage.ts";
import { buttonsIn, element } from "./elements.ts";
import { createExtras, extrasFor } from "./extras.ts";
import type { Action } from "./hands.ts";
import type { PlayRun, Shown } from "./runs.ts";
import { attachTab } from "./tab.ts";

// What the page shows: the screen with its card (the first-screen card before a run, the card after one), the counts above it, the quest
// and levels to choose from, and on a touch screen the thumb marks, the Levels and Bag tab and the buttons of the place Glitchy is in; the
// milestones earned and the Hall of Fame. Every place a number or a word changes has a place of its own that never grows, so nothing under
// the player's thumb moves.
export const logicalWidth = 256;
export const logicalHeight = 144;
// The screen is drawn at twice its size, so its words are sharp.
const scale = 2;
const none = "—";

const screenWords: Readonly<Record<Shown, string>> = {
  castle:
    "The game screen: a map of the woods and the castle seen from above, where Glitchy meets dragon friends and cheers up grumpy guards",
  hills:
    "The game screen: Glitchy the baby dragon running and jumping across sunny hills, catching eggs and breathing fire",
  nursery:
    "The game screen: the secret Sky Nursery, where Glitchy gathers eggs, hatches baby dragons, dances and paints the night sky",
  woods:
    "The game screen: a moonlit maze of trees seen through Glitchy's eyes, then the woods and DeFu's lair seen from above, with caged dragons, rocket keys and her egg rocket",
};

const actWords: Readonly<Record<Shown, string>> = {
  castle: "Talk",
  hills: "Jump",
  nursery: "Dance",
  woods: "Use",
};

// What the right thumb's two zones are called in each level (`thumbs.ts`).
const fireWords: Readonly<Record<Shown, string>> = {
  castle: "Fire",
  hills: "Fire",
  nursery: "Paint",
  woods: "Fire",
};

export interface ViewOptions {
  // What a touch button over the screen holds (`extras.ts`).
  readonly hold?: (action: Action, on: boolean) => void;
}

export function createView({ hold = () => undefined }: ViewOptions = {}) {
  const main = element("main", "main");
  const screen = element("screen", "canvas");
  const context = screen.getContext("2d");
  const layer = createGuideLayer(screen);
  const tab = attachTab(main);
  const extras = createExtras(main, hold);
  const world = element("world", "canvas");
  const testBadge = element("test-badge", "div");
  // In the admin's test mode nothing is counted, so the counts that would be are not shown.
  let testing = false;
  // The three-dimensional view is made the first time the woods outside the maze are shown (null where it cannot be).
  let depth: DepthView | null | undefined;
  const scoreOut = element("score", "strong");
  const bestOut = element("best", "strong");
  const plasmaOut = element("plasma", "strong");
  const bankedOut = element("banked", "strong");
  const statLabels = [0, 1, 2].map((at) =>
    element(`stat-${String(at)}-label`, "span"),
  );
  const statValues = [0, 1, 2].map((at) =>
    element(`stat-${String(at)}`, "strong"),
  );
  const earnedList = element("earned", "ul");
  const startButton = element("start", "button");
  const pauseButton = element("pause", "button");
  const shareButton = element("share", "button");
  const thumbAct = element("thumb-act", "span");
  const thumbFire = element("thumb-fire", "span");
  const picker = element("chapters", "nav");
  // The level on the screen, whether Glitchy is out of the woods' maze, and whether a run is going: what the tab and the corner offer
  // (the Levels between runs; during one the Bag, where there is a backpack, and the buttons of the place).
  let shown: Shown = "hills";
  let outside = false;
  let playing = false;
  // The card after the run that is over, until the next one starts.
  let result: ResultCard | null = null;
  const offer = (): void => {
    tab.offer(playing, shown !== "nursery");
    extras.show(playing ? extrasFor(shown, outside) : null);
  };
  const fameList = element("fame", "ol");
  const fameNote = element("fame-note", "p");
  screen.width = logicalWidth * scale;
  screen.height = logicalHeight * scale;

  return {
    // The run (or its idle screen) and the counts that go with it; over the screen, the first-screen card while it is idle and the card
    // after a run once one is over (`over`).
    draw(run: PlayRun, idle: boolean, best: number, banked: number): void {
      scoreOut.textContent = testing ? none : String(idle ? 0 : run.score());
      bestOut.textContent = testing ? none : String(best);
      plasmaOut.textContent = testing ? none : String(idle ? 0 : run.plasma());
      bankedOut.textContent = banked.toLocaleString("en-US");
      run.stats().forEach(([label, value], at) => {
        const labelOut = statLabels[at];
        const valueOut = statValues[at];
        if (labelOut !== undefined) labelOut.textContent = label;
        if (valueOut !== undefined)
          valueOut.textContent = testing && label === "Time" ? none : value;
      });
      const phase: Phase = idle ? "ready" : playing ? "running" : "over";
      layer.show(cardFor(phase, guides[run.id], () => result));
      const woods = run.depth();
      if ((woods !== null) !== outside) {
        outside = woods !== null;
        offer();
      }
      if (context === null) return;
      if (woods !== null && depth === undefined) depth = createDepthView(world);
      const layered = woods !== null && depth !== null && depth !== undefined;
      world.hidden = !layered;
      if (layered) depth?.show(woods);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, logicalWidth, logicalHeight);
      context.imageSmoothingEnabled = false;
      run.draw(context, layered);
      if (testing) drawTestMark(context);
    },
    // What is chosen (the quest or a level), and which levels are open to practise.
    chapters(chosen: PlayId, progress: Progress, running: boolean): void {
      for (const button of buttonsIn(picker, "button[data-chapter]")) {
        const id = playIds.find((play) => play === button.dataset.chapter);
        if (id === undefined) continue;
        const open = isOpen(progress, id);
        button.disabled = running || !open;
        button.setAttribute("aria-pressed", String(id === chosen));
        button.title =
          id === "quest"
            ? "All three levels in one run, against the clock"
            : open
              ? chapterTitles[id]
              : "Clear the level before to practise this one";
        button.dataset.locked = String(!open);
        const number = button.querySelector("span");
        if (number !== null)
          number.textContent = open ? String(playIds.indexOf(id)) : "🔒";
      }
    },
    // The level on the screen: what the screen shows, what the right thumb's zones are called in it, and what the tab and the corner offer.
    level(level: Shown): void {
      shown = level;
      screen.setAttribute("aria-label", screenWords[level]);
      thumbAct.textContent = actWords[level];
      thumbFire.textContent = fireWords[level];
      offer();
    },
    // The Hall of Fame: the best won quests, best first.
    fame(entries: readonly FameEntry[]): void {
      fameNote.hidden = entries.length > 0;
      fameList.replaceChildren(
        ...entries.map((entry, at) => {
          const item = document.createElement("li");
          item.textContent = `${entry.score.toLocaleString("en-US")} points in ${clockOf(entry.ticks)}, ${String(entry.hearts)} ${entry.hearts === 1 ? "heart" : "hearts"}, ${String(entry.eggs)} eggs, ${String(entry.secrets)} secrets`;
          item.dataset.rank = String(at + 1);
          return item;
        }),
      );
    },
    earned(ids: readonly string[], titles: ReadonlyMap<string, string>): void {
      earnedList.replaceChildren(
        ...ids.map((id) => {
          const item = document.createElement("li");
          item.dataset.milestone = id;
          item.textContent = titles.get(id) ?? id;
          return item;
        }),
      );
    },
    // The card for the run just over.
    over(card: ResultCard): void {
      result = card;
    },
    // The admin's test mode, on or off: its badge, and the start button's words.
    testing(on: boolean): void {
      testing = on;
      testBadge.hidden = !on;
      startButton.textContent = on ? "Start test run" : "Start run";
      shareButton.disabled = on;
    },
    // A run going or not: Start or pause, the card, the tab's handle and the corner's buttons, and (for `thumbs.css`) the thumb marks, which
    // on a phone held on its side wait for a run so the first-screen card is clear of them.
    running(on: boolean): void {
      playing = on;
      if (on) result = null;
      main.dataset.running = String(on);
      startButton.hidden = on;
      pauseButton.disabled = !on;
      shareButton.disabled = on || testing;
      offer();
    },
  };
}

export type View = ReturnType<typeof createView>;

// The play a click in the chapter picker chose, if it was on one.
export function pickedFrom(event: Event): PlayId | undefined {
  const target =
    event.target instanceof Element
      ? event.target.closest("[data-chapter]")
      : null;
  return playIds.find((name) => name === target?.getAttribute("data-chapter"));
}
