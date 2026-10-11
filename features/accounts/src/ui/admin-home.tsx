import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { ArcadeButton, ArcadeEmptyState, PageFrame } from "@repo/ui/arcade";

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
      eyebrow="Platform operations"
      footerLabel="Authenticated beta workspace"
      heading="Admin console"
      intro="Choose a staff area. Reviews are separated from broader platform authority, and nothing here publishes or deploys anything."
      navigation={navigation}
      notices={["◆ STAFF ONLY", "▲ PRIVATE ROUTE", "★ SERVER AUTHORITY"]}
    >
      {areas.length === 0 ? (
        <ArcadeEmptyState title="No staff areas yet">
          Staff areas appear here as they are enabled for your assignment.
        </ArcadeEmptyState>
      ) : (
        <ul aria-label="Staff areas" className="arcade-cards">
          {areas.map((area) => (
            <li key={area.href}>
              <article className="arcade-card">
                <p className="arcade-eyebrow">Admin</p>
                <h3 className="arcade-card__title">{area.label}</h3>
                <ArcadeButton
                  ariaLabel={`Open ${area.label}`}
                  href={area.href}
                  tone="cyan"
                >
                  Open
                </ArcadeButton>
              </article>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
