import type { ShellWorkArea } from "./navigation-model.ts";

// The links inside one work area (the studio, the admin), beside the page on a wide screen and as a
// row of tabs above it on a narrow one.
export function AreaSidebar({ area }: { readonly area: ShellWorkArea }) {
  return (
    <nav className="area-sidebar" aria-label={`${area.label} sections`}>
      <p className="area-sidebar__title">{area.label}</p>
      <ul>
        {area.items.map((item) => (
          <li key={item.href}>
            <a
              aria-current={item.current === "page" ? "page" : undefined}
              className="area-sidebar__link"
              data-current={item.current === undefined ? undefined : "true"}
              href={item.href}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
