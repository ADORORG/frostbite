// The page's own elements, found by id. A missing one is a broken page, so it stops the game before anything is drawn.
export function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag] {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  // Checked just above: the element's tag is the one asked for.
  return found as HTMLElementTagNameMap[Tag];
}

export const buttonsIn = (
  root: ParentNode,
  selector: string,
): readonly HTMLButtonElement[] =>
  [...root.querySelectorAll(selector)].filter(
    (found) => found instanceof HTMLButtonElement,
  );
