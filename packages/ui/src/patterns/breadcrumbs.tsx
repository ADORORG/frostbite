import type { ShellCrumb } from "./navigation-model.ts";

// Where the person is inside a work area, with a link back up. The last crumb is the page itself.
export function Breadcrumbs({
  crumbs,
}: {
  readonly crumbs: readonly ShellCrumb[];
}) {
  if (crumbs.length === 0) return null;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.label}>
            {crumb.href === undefined ? (
              <span
                aria-current={index === crumbs.length - 1 ? "page" : undefined}
              >
                {crumb.label}
              </span>
            ) : (
              <a href={crumb.href}>{crumb.label}</a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
