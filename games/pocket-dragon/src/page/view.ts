import { drawGuide } from "@ador/game-sdk/guide";

import { chapterTitles } from "../chapters.ts";
import { guides } from "../guide.ts";
import { isOpen, type Progress } from "../progress.ts";
import { chapterIds, type ChapterId } from "../rules/constants.ts";
import { buttonsIn, element } from "./elements.ts";
import type { ChapterRun } from "./runs.ts";

// What the page shows: the screen, the counts above it, the chapters to choose from, the touch buttons and the milestones earned. Every
// place a number or a word changes has a place of its own that never grows, so nothing under the player's thumb moves.
export const logicalWidth = 256;
export const logicalHeight = 144;
// The screen is drawn at twice its size, so its words are sharp.
const scale = 2;

const screenWords: Readonly<Record<ChapterId, string>> = {
  castle:
    "The game screen: a map of the woods and the castle seen from above, where Glitchy meets dragon friends and cheers up grumpy guards",
  hills:
    "The game screen: Glitchy the baby dragon running and jumping across sunny hills, catching eggs and breathing fire",
  woods:
    "The game screen: a walk through a moonlit maze of trees seen through Glitchy's eyes, with clue stones, lanterns and treasure chests",
};

const actWords: Readonly<Record<ChapterId, string>> = {
  castle: "Talk",
  hills: "Jump",
  woods: "Fire",
};

// The touch buttons each chapter offers; the others keep their place but are not shown.
const padOf: Readonly<Record<ChapterId, readonly string[]>> = {
  castle: [
    "left",
    "right",
    "up",
    "down",
    "act",
    "fire",
    "quick",
    "evade",
    "charm",
  ],
  hills: ["left", "right", "act", "fire"],
  woods: ["left", "right", "up", "down", "fire"],
};

export function createView() {
  const screen = element("screen", "canvas");
  const context = screen.getContext("2d");
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
  const pad = element("pad", "div");
  const picker = element("chapters", "nav");
  const actButton = element("act", "button");
  screen.width = logicalWidth * scale;
  screen.height = logicalHeight * scale;

  return {
    // The chapter's run (or its idle screen, with the guide over it) and the counts that go with it.
    draw(run: ChapterRun, idle: boolean, best: number, banked: number): void {
      scoreOut.textContent = String(idle ? 0 : run.score());
      bestOut.textContent = String(best);
      plasmaOut.textContent = String(idle ? 0 : run.plasma());
      bankedOut.textContent = banked.toLocaleString("en-US");
      run.stats().forEach(([label, value], at) => {
        const labelOut = statLabels[at];
        const valueOut = statValues[at];
        if (labelOut !== undefined) labelOut.textContent = label;
        if (valueOut !== undefined) valueOut.textContent = value;
      });
      if (context === null) return;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.imageSmoothingEnabled = false;
      run.draw(context);
      if (idle) drawGuide(context, logicalWidth, logicalHeight, guides[run.id]);
    },
    // Which chapter is chosen, which are open, and what the touch buttons mean in it.
    chapters(chosen: ChapterId, progress: Progress, running: boolean): void {
      for (const button of buttonsIn(picker, "button[data-chapter]")) {
        const id = chapterIds.find(
          (chapter) => chapter === button.dataset.chapter,
        );
        if (id === undefined) continue;
        const open = isOpen(progress, id);
        button.disabled = running || !open;
        button.setAttribute("aria-pressed", String(id === chosen));
        button.title = open
          ? chapterTitles[id]
          : "Clear the chapter before to open this one";
        button.dataset.locked = String(!open);
        const number = button.querySelector("span");
        if (number !== null)
          number.textContent = open ? String(chapterIds.indexOf(id) + 1) : "🔒";
      }
      screen.setAttribute("aria-label", screenWords[chosen]);
      actButton.textContent = actWords[chosen];
      for (const button of buttonsIn(pad, "button[data-hold]"))
        button.hidden = !padOf[chosen].includes(button.dataset.hold ?? "");
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
    running(on: boolean): void {
      startButton.hidden = on;
      pauseButton.disabled = !on;
      shareButton.disabled = on;
      for (const button of buttonsIn(pad, "button")) button.disabled = !on;
    },
  };
}

export type View = ReturnType<typeof createView>;
