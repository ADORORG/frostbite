import { DetailsMenu } from "../components/details-menu.tsx";
import type { ShellNavigationItem } from "./navigation-model.ts";

// Account links in one menu. A single link is not drawn in the bar at all: the wallet beside it opens a menu that links to the account
// page, and the narrow-screen menu lists it, so a second "Account" chip would only repeat it.
// The menu is a plain disclosure, so it works without scripts and with the keyboard.
export function AccountMenu({
  items,
}: {
  readonly items: readonly ShellNavigationItem[];
}) {
  if (items.length <= 1) return null;
  return (
    <DetailsMenu
      className="account-menu"
      current={items.some((item) => item.current !== undefined)}
      label="Account"
      trigger="Account"
    >
      <ul className="menu-list">
        {items.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.current === "page" ? "page" : undefined}
              className="menu-link"
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </DetailsMenu>
  );
}
