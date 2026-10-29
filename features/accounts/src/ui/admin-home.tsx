import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeButton,
  ArcadeEmptyState,
  PageFrame,
  Tile,
} from "@repo/ui/arcade";

// The staff overview: where each staff area the person may open begins. The areas come from the
// navigation the platform already resolved for this person, so a link here never leads to a page that
// would refuse them, and a new staff feature appears without this page changing. The overview itself is
// left out, and nothing here claims a count the platform cannot yet supply.
export function AdminHome({
  navigation,
}: {
  readonly navigation: readonly NavigationItem[];
}) {
  const areas = navigation.filter(
    (item) => item.area === "admin" && item.current !== "page",
  );
  return (
    <PageFrame
      eyebrow="Admin"
      heading="Admin console"
      intro="Choose a staff area. Reviews are separated from broader platform authority, and nothing here publishes or deploys anything."
      navigation={navigation}
    >
      {areas.length === 0 ? (
        <ArcadeEmptyState title="No staff areas yet">
          Staff areas appear here as they are enabled for your assignment.
        </ArcadeEmptyState>
      ) : (
        <ul aria-label="Staff areas" className="tile-grid" role="list">
          {areas.map((area) => (
            <li key={area.href}>
              <Tile
                footer={
                  <ArcadeButton
                    ariaLabel={`Open ${area.label}`}
                    href={area.href}
                    tone="cyan"
                  >
                    Open
                  </ArcadeButton>
                }
                title={area.label}
              />
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
