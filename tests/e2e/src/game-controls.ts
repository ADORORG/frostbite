import type { Page } from "@playwright/test";

import type { Box } from "./game-layout.ts";

// What a thumb can use on a game's page, and the readouts the page draws, measured in a browser with a touch screen. The games are played
// with taps and swipes on the screen itself, so what is left to touch is a corner of small icons, and none may crowd another.
export interface Controls {
  readonly hud: Box | null;
  readonly targets: readonly Box[];
}

// The smallest side of a thing to press (the platform's own guidance for touch targets), and how many a game may keep.
export const minimumTarget = 44;
export const maximumTargets = 3;

// Run in the page: every button, field and link a reader could press (not hidden, not without size) and the line of readouts.
const measure = `(() => {
  const round = (n) => Math.round(n);
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const boxOf = (el, name) => { const r = el.getBoundingClientRect(); return { h: round(r.height), name, w: round(r.width), x: round(r.left), y: round(r.top) }; };
  const targets = [...document.querySelectorAll("button, input, a[href]")].filter(seen)
    .map((el) => boxOf(el, el.id || el.getAttribute("data-sound") || el.getAttribute("aria-label") || el.tagName.toLowerCase()));
  const hud = document.querySelector(".score, .meter");
  return { hud: hud && seen(hud) ? boxOf(hud, "hud") : null, targets };
})()`;

export async function measureControls(page: Page): Promise<Controls> {
  // The script above is this module's own, and returns exactly this shape.
  return page.evaluate<Controls>(measure);
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// What is wrong with the controls of a game in a frame this size: too many, too small, off the frame, or on top of one another or of the
// readouts. An empty list is a page a thumb can use.
export function controlProblems(
  controls: Controls,
  frame: { readonly height: number; readonly width: number },
): string[] {
  const problems: string[] = [];
  const { hud, targets } = controls;
  if (targets.length > maximumTargets)
    problems.push(
      `${String(targets.length)} things to press (${targets.map(({ name }) => name).join(", ")}), at most ${String(maximumTargets)}`,
    );
  for (const box of targets) {
    if (box.w < minimumTarget || box.h < minimumTarget)
      problems.push(
        `${box.name} is ${String(box.w)}x${String(box.h)}, under ${String(minimumTarget)}`,
      );
    if (
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.w > frame.width ||
      box.y + box.h > frame.height
    )
      problems.push(`${box.name} is outside the frame`);
  }
  targets.forEach((box, index) => {
    for (const other of targets.slice(index + 1))
      if (overlaps(box, other))
        problems.push(`${box.name} overlaps ${other.name}`);
    if (hud !== null && overlaps(box, hud))
      problems.push(`${box.name} overlaps the readouts`);
  });
  return problems;
}
