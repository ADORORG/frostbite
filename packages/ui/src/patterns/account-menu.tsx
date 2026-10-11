import type { ShellNavigationItem } from "./navigation-model.ts";

// Account links in one menu. A single link is shown as itself, since a menu of one is only a click more.
// The menu is a plain disclosure, so it works without scripts and with the keyboard.
export function AccountMenu({
  items,
}: {
  readonly items: readonly ShellNavigationItem[];
}) {
  const [first] = items;
  if (first === undefined) return null;
  if (items.length === 1)
    return (
      <a
        aria-current={first.current === "page" ? "page" : undefined}
        className="app-nav-link app-nav-link--account"
        data-current={first.current === undefined ? undefined : "true"}
        href={first.href}
      >
        {first.label}
      </a>
    );
  return (
    <details className="account-menu">
      <summary
        className="app-nav-link app-nav-link--account"
        data-current={
          items.some((item) => item.current !== undefined) ? "true" : undefined
        }
      >
        Account
      </summary>
      <ul className="account-menu__list">
        {items.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.current === "page" ? "page" : undefined}
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
