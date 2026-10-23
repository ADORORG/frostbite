import { DetailsMenu } from "../components/details-menu.tsx";
import type {
  ShellNavigationItem,
  ShellNavigationModel,
} from "./navigation-model.ts";

function MenuLink({ item }: { readonly item: ShellNavigationItem }) {
  return (
    <li>
      <a
        aria-current={item.current === "page" ? "page" : undefined}
        className="menu-link"
        data-current={item.current === undefined ? undefined : "true"}
        href={item.href}
      >
        {item.label}
      </a>
    </li>
  );
}

function Group({
  heading,
  items,
}: {
  readonly heading?: string;
  readonly items: readonly ShellNavigationItem[];
}) {
  if (items.length === 0) return null;
  return (
    <>
      {heading === undefined ? null : <p className="menu-group">{heading}</p>}
      <ul className="menu-list">
        {items.map((item) => (
          <MenuLink item={item} key={item.href} />
        ))}
      </ul>
    </>
  );
}

// The whole bar in one menu, for a screen too narrow to lay the links out: the places anyone may go, the work areas, and the
// account's links, each group named. The bar's own links are hidden at that width, so nothing is offered twice.
export function NavMenu({ model }: { readonly model: ShellNavigationModel }) {
  const areas = model.areas.map((area): ShellNavigationItem => ({
    area: area.area,
    ...(model.active === area ? { current: "section" as const } : {}),
    href: area.href,
    label: area.label,
  }));
  const current =
    [...model.main, ...model.account].some(
      (item) => item.current !== undefined,
    ) || model.active !== null;
  return (
    <DetailsMenu
      align="end"
      className="nav-menu"
      current={current}
      label="Menu"
      trigger={
        <>
          <span aria-hidden="true" className="nav-menu__icon" />
          <span>Menu</span>
        </>
      }
    >
      <nav aria-label="Menu">
        <Group items={model.main} />
        <Group heading="Work" items={areas} />
        <Group heading="Account" items={model.account} />
      </nav>
    </DetailsMenu>
  );
}
