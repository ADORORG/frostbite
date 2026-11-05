// The two small things every game's page does with its elements: find one by its id and tag (failing loudly if the page lacks it), and write
// text only if it differs, so a box that has not changed is not touched.
export function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag] {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  return found as HTMLElementTagNameMap[Tag];
}

export function setText(box: HTMLElement, text: string): void {
  if (box.textContent !== text) box.textContent = text;
}

// The page's boxes, found once.
export function boxes() {
  return {
    count: element("count", "strong"),
    earned: element("earned", "ul"),
    note: element("note", "p"),
    pause: element("pause", "button"),
    screen: element("screen", "canvas"),
    sound: element("sound", "div"),
    start: element("start", "button"),
    status: element("status", "p"),
    total: element("total", "span"),
  };
}

// Adds a milestone to the list of those earned this run, under its title (or its id until the titles are known), and counts it.
export function listEarned(
  page: ReturnType<typeof boxes>,
  id: string,
  title: string | undefined,
  count: number,
): void {
  setText(page.count, String(count));
  const item = document.createElement("li");
  item.dataset.milestone = id;
  item.textContent = title ?? id;
  page.earned.append(item);
  page.earned.scrollTop = page.earned.scrollHeight;
}
