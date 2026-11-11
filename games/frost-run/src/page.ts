// The page's parts, found once by id and checked to be what the page says they are.
function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag] {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  return found as HTMLElementTagNameMap[Tag];
}

export const page = {
  best: element("best", "strong"),
  earned: element("earned", "ul"),
  flash: element("flash", "div"),
  main: element("main", "main"),
  note: element("note", "p"),
  pause: element("pause", "button"),
  result: element("result", "section"),
  screen: element("screen", "canvas"),
  select: element("select", "section"),
  share: element("share", "section"),
  sound: element("sound", "div"),
  stage: element("stage", "div"),
  start: element("start", "button"),
  status: element("status", "p"),
} as const;

// A tap on the screen starts a run on a touch screen. A tap on a panel's button is the button's own and goes no further; a tap anywhere
// else on the hero select or the card after a run is a tap on the screen. Every tap on the share card stays on it, so a press to save the
// picture never starts a run.
const stop = (event: Event): void => event.stopPropagation();
const stopAtButton = (event: Event): void => {
  if (
    event.target instanceof Element &&
    event.target.closest("button") !== null
  )
    stop(event);
};

export function stopAtButtons(...panels: readonly HTMLElement[]): void {
  for (const panel of panels)
    for (const type of ["pointerdown", "click"])
      panel.addEventListener(type, stopAtButton);
}

export function keepTaps(panel: HTMLElement): void {
  for (const type of ["pointerdown", "click"])
    panel.addEventListener(type, stop);
}
