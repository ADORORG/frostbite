import type { HomeSection } from "@ador/plugin-kit";

import type { HomeSectionView } from "../ui/home.tsx";

// Draws every part of the landing page the features supplied. One that fails is left out and reported, so a rail that cannot load does
// not take the whole page with it; each part says for itself what it shows when it has nothing, or cannot reach it.
export async function drawSections(
  sections: readonly HomeSection[],
  report: (line: string) => void = (line) => console.error(line),
): Promise<readonly HomeSectionView[]> {
  const drawn = await Promise.all(
    sections.map(async ({ id, render }) => {
      try {
        return { id, node: await render() };
      } catch {
        report(JSON.stringify({ event: "home.section_failed", sectionId: id }));
        return null;
      }
    }),
  );
  return drawn.filter((view) => view !== null);
}
