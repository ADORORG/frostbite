import { service } from "./world.ts";

type Query = Parameters<typeof service.reviewQueue>[0];

export const names = (page: { items: readonly { displayName: string }[] }) =>
  page.items.map(({ displayName }) => displayName);

// Every page of a list, followed to its end by the cursor each page hands on.
async function pagesOf(group: Query["group"], sort: Query["sort"]) {
  const pages: Awaited<ReturnType<typeof service.reviewQueue>>[] = [];
  let position: Query["position"] = null;
  do {
    const page = await service.reviewQueue({ group, position, sort });
    pages.push(page);
    position = page.nextPosition;
  } while (position !== null);
  return pages;
}

// The names on each page.
export async function allPages(group: Query["group"], sort: Query["sort"]) {
  return (await pagesOf(group, sort)).map(names);
}

// The id of every application in a list, across all its pages.
export async function allIds(group: Query["group"], sort: Query["sort"]) {
  return (await pagesOf(group, sort)).flatMap((page) =>
    page.items.map(({ applicationId }) => applicationId),
  );
}
