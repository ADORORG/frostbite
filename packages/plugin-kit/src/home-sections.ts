import type { ReactNode } from "react";

// A part of the landing page a feature supplies for itself (a rail of its own things). The shell lays the parts out in `order` and
// knows nothing of what they show, so a feature is added to the landing page by declaring one, and the shell imports no feature.
export interface HomeSection {
  readonly id: string;
  // Lower first.
  readonly order: number;
  readonly render: () => ReactNode | Promise<ReactNode>;
}

// Every loaded feature's parts of the landing page, lowest order first and then by id, frozen. Two parts with one id are refused.
export function collectHomeSections(
  entrypoints: readonly { readonly homeSections?: readonly HomeSection[] }[],
): readonly HomeSection[] {
  const sections = entrypoints.flatMap(({ homeSections = [] }) => homeSections);
  if (new Set(sections.map(({ id }) => id)).size !== sections.length)
    throw new Error("Every home section has an id of its own.");
  return Object.freeze(
    [...sections].sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    ),
  );
}
