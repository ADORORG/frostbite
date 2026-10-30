import type { Page } from "@playwright/test";

// What a game page measures, for checking that it fits its frame: whether it scrolls, how much of the frame the screen takes, and where
// every named part of the page sits (the desktop guard compares those places before and after a change).
export interface Box {
  readonly h: number;
  readonly name: string;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

export interface GameLayout {
  readonly boxes: readonly Box[];
  // The biggest canvas (or the board, in a game made of page elements) on the page, which is the screen, or null when there is none.
  readonly canvas: Box | null;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly scrollHeight: number;
  readonly scrollWidth: number;
}

// Run in the page. A part is named by its tag, id and first class, so a re-ordered list of the same parts is the same layout.
const measure = `(() => {
  const round = (n) => Math.round(n);
  const named = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList[0] ? "." + el.classList[0] : "");
  const boxOf = (el) => { const r = el.getBoundingClientRect(); return { h: round(r.height), name: named(el), w: round(r.width), x: round(r.left), y: round(r.top) }; };
  const boxes = [...document.body.querySelectorAll("*")].filter((el) => el.id || el.classList.length > 0).map(boxOf);
  const canvases = [...document.querySelectorAll("canvas, #board")].map(boxOf).sort((a, b) => b.w * b.h - a.w * a.h);
  const root = document.documentElement;
  return {
    boxes,
    canvas: canvases[0] ?? null,
    clientHeight: root.clientHeight,
    clientWidth: root.clientWidth,
    scrollHeight: root.scrollHeight,
    scrollWidth: root.scrollWidth,
  };
})()`;

export async function measureLayout(page: Page): Promise<GameLayout> {
  // The script above is this module's own, and returns exactly this shape.
  return page.evaluate<GameLayout>(measure);
}
