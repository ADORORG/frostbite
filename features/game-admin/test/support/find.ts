// A button by its name: its accessible label where it has one (a short visible word such as "Publish" is named for what it
// publishes), else its words.
export function byName(
  container: HTMLElement,
  name: string,
): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find(
      (candidate) =>
        (candidate.getAttribute("aria-label") ?? candidate.textContent) ===
        name,
    ) ?? null
  );
}
