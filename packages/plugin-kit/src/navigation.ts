import {
  defaultNavigationOrder,
  type NavigationArea,
  type NavigationContribution,
  type PageAccessRequirement,
} from "@frostbite/shared/features";

export type NavigationAudience = Exclude<
  PageAccessRequirement["kind"],
  "platform"
>;

// `current` says whether the item is the page being shown ("page") or the section the page sits in
// ("section", for example the collection list on a single collection's page).
export type NavigationCurrent = "page" | "section";

export interface NavigationItem {
  readonly area: NavigationArea;
  readonly current?: NavigationCurrent;
  readonly href: string;
  readonly label: string;
}

// Stable: links that share a position keep the order their features were registered in.
function inDisplayOrder(
  contributions: readonly NavigationContribution[],
): readonly NavigationContribution[] {
  const position = ({ order }: NavigationContribution) =>
    order ?? defaultNavigationOrder;
  return [...contributions].sort((a, b) => position(a) - position(b));
}

const audienceRank = {
  authenticated: 1,
  platform: 2,
  public: 0,
} as const satisfies Readonly<Record<PageAccessRequirement["kind"], number>>;

export function navigationForAudience(
  contributions: readonly NavigationContribution[],
  audience: NavigationAudience,
): readonly NavigationItem[] {
  const maximumRank = audienceRank[audience];
  return Object.freeze(
    inDisplayOrder(contributions)
      .filter(({ access }) => audienceRank[access.kind] <= maximumRank)
      .map(({ area, href, label }) => Object.freeze({ area, href, label })),
  );
}

export async function navigationForUser(
  contributions: readonly NavigationContribution[],
  isAllowed: (capability: string) => Promise<boolean>,
): Promise<readonly NavigationItem[]> {
  const items = await Promise.all(
    inDisplayOrder(contributions).map(async ({ access, area, href, label }) => {
      if (access.kind !== "platform") {
        return Object.freeze({ area, href, label });
      }
      try {
        if (await isAllowed(access.capability)) {
          return Object.freeze({ area, href, label });
        }
      } catch {
        // Navigation is convenience, never authorization. Provider failures fail closed.
      }
      return null;
    }),
  );
  return Object.freeze(
    items.filter((item): item is NavigationItem => item !== null),
  );
}

// Marks the one item that best matches the path: the longest href that is the path itself or a parent of
// it. Items that match nothing are left unmarked, so a page outside the navigation marks nothing.
export function markCurrent(
  items: readonly NavigationItem[],
  path: string,
): readonly NavigationItem[] {
  let best: NavigationItem | null = null;
  for (const item of items) {
    const matches = path === item.href || path.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.href.length))
      best = item;
  }
  return Object.freeze(
    items.map((item) =>
      item === best
        ? Object.freeze({
            ...item,
            current: path === item.href ? "page" : "section",
          } satisfies NavigationItem)
        : item,
    ),
  );
}
