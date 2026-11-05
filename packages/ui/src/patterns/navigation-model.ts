// How the shell groups the flat list of navigation links. The areas mirror the manifest's navigation
// areas (`@frostbite/shared/features`); a link whose area is missing here fails to type-check where a page hands
// its navigation to the shell, so the two cannot drift.
export type ShellArea = "account" | "admin" | "footer" | "main" | "studio";

// "page" is the page being shown, "section" the section it sits inside.
export type ShellCurrent = "page" | "section";

export interface ShellNavigationItem {
  readonly area: ShellArea;
  readonly current?: ShellCurrent;
  readonly href: string;
  readonly label: string;
}

// The work areas: each is one entry in the bar, and a sidebar of its own links inside.
const workAreaLabels = { studio: "Studio", admin: "Admin" } as const;
type WorkArea = keyof typeof workAreaLabels;

export interface ShellWorkArea {
  readonly area: WorkArea;
  // The entry's destination is the first link of the area the person may see, never a fixed page, so a
  // person who can reach only part of an area is not sent to a page that refuses them.
  readonly href: string;
  readonly items: readonly ShellNavigationItem[];
  readonly label: string;
}

export interface ShellCrumb {
  readonly href?: string;
  readonly label: string;
}

export interface ShellNavigationModel {
  readonly account: readonly ShellNavigationItem[];
  readonly active: ShellWorkArea | null;
  readonly areas: readonly ShellWorkArea[];
  readonly breadcrumb: readonly ShellCrumb[];
  readonly footer: readonly ShellNavigationItem[];
  readonly main: readonly ShellNavigationItem[];
}

const workAreas = Object.keys(workAreaLabels).filter(
  (area): area is WorkArea => area in workAreaLabels,
);

function inArea(items: readonly ShellNavigationItem[], area: ShellArea) {
  return items.filter((item) => item.area === area);
}

function breadcrumbFor(
  area: ShellWorkArea,
  current: ShellNavigationItem,
): readonly ShellCrumb[] {
  // On the area's own first page the bar already says where the person is, so there is nothing to follow.
  const isRoot = current === area.items[0] && current.current === "page";
  if (isRoot) return [];
  return [
    { href: area.href, label: area.label },
    current.current === "section"
      ? { href: current.href, label: current.label }
      : { label: current.label },
  ];
}

export function buildNavigationModel(
  items: readonly ShellNavigationItem[],
): ShellNavigationModel {
  const areas: ShellWorkArea[] = [];
  for (const area of workAreas) {
    const own = inArea(items, area);
    const [first] = own;
    if (first !== undefined)
      areas.push({
        area,
        href: first.href,
        items: own,
        label: workAreaLabels[area],
      });
  }
  const active = areas.find(({ items: own }) =>
    own.some((item) => item.current !== undefined),
  );
  const current = active?.items.find((item) => item.current !== undefined);
  return {
    account: inArea(items, "account"),
    active: active ?? null,
    areas,
    breadcrumb:
      active === undefined || current === undefined
        ? []
        : breadcrumbFor(active, current),
    footer: inArea(items, "footer"),
    main: inArea(items, "main"),
  };
}
