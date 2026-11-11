import { readFileSync } from "node:fs";
import { join } from "node:path";

// The game's own page, without its script, as the document a jsdom test works in.
const html = readFileSync(
  join(import.meta.dirname, "../../index.html"),
  "utf8",
);
const body = /<body>([\s\S]*)<\/body>/u.exec(html)?.[1] ?? "";

export const loadPage = (): void => {
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gu, "");
};

export const byId = <T extends HTMLElement>(
  id: string,
  type: new () => T,
): T => {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
};

export const click = (element: Element | null | undefined): void => {
  element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
