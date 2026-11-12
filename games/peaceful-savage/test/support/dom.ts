import { readFileSync } from "node:fs";
import { join } from "node:path";

// The page's own body (from `index.html`), laid into the test's document, so the page's parts find their elements as they would on the
// real page.
const html = readFileSync(
  join(import.meta.dirname, "../../index.html"),
  "utf8",
);

export function loadPage(): void {
  const start = html.indexOf("<main");
  const end = html.indexOf("</main>") + "</main>".length;
  document.body.innerHTML = html.slice(start, end);
}

export const byId = <Tag extends HTMLElement = HTMLElement>(
  id: string,
): Tag => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`no #${id}`);
  // The test names the kind of element it expects; a wrong one fails the test where it is used.
  return found as Tag;
};

// A pointer event as a finger (or a mouse) makes it.
export function pointer(
  target: EventTarget,
  type: string,
  fields: { id?: number; kind?: string; x?: number; y?: number } = {},
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: fields.x ?? 0,
    clientY: fields.y ?? 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: fields.id ?? 1 },
    pointerType: { value: fields.kind ?? "touch" },
  });
  target.dispatchEvent(event);
}
