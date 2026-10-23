import type { ReactNode } from "react";

import { AccountMenu } from "./account-menu.tsx";
import { AreaSidebar } from "./area-sidebar.tsx";
import { Breadcrumbs } from "./breadcrumbs.tsx";
import { NavMenu } from "./nav-menu.tsx";
import { HeaderSlot, HeaderStatusSlot } from "./shell-slots.tsx";
import {
  buildNavigationModel,
  type ShellNavigationItem,
} from "./navigation-model.ts";

export type {
  ShellArea,
  ShellCurrent,
  ShellNavigationItem,
} from "./navigation-model.ts";

interface AppShellProps {
  readonly brand: string;
  readonly children: ReactNode;
  readonly footerLabel: string;
  readonly homeHref: string;
  // A page that is one thing to look at or play (a game) gives up the notices strip above the header, so that thing gets the room.
  readonly immersive?: boolean;
  readonly navigation: readonly ShellNavigationItem[];
  readonly notices: readonly string[];
}

function NavLink({ item }: { readonly item: ShellNavigationItem }) {
  return (
    <a
      aria-current={item.current === "page" ? "page" : undefined}
      className="app-nav-link"
      data-current={item.current === undefined ? undefined : "true"}
      href={item.href}
    >
      {item.label}
    </a>
  );
}

export function AppShell({
  brand,
  children,
  footerLabel,
  homeHref,
  immersive = false,
  navigation,
  notices,
}: AppShellProps) {
  const model = buildNavigationModel(navigation);
  // A sidebar of one link says nothing the bar does not, so it appears only when there is somewhere to go.
  const sidebarArea =
    model.active !== null && model.active.items.length > 1
      ? model.active
      : null;
  return (
    <div
      className="app-shell"
      data-immersive={immersive ? "true" : undefined}
      id="top"
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div
        className="arcade-marquee"
        role="region"
        aria-label="Platform status"
      >
        <div className="arcade-marquee__track">
          {notices.map((notice) => (
            <span key={notice}>{notice}</span>
          ))}
        </div>
      </div>
      <header className="app-header">
        <a className="app-brand" href={homeHref} aria-label={`${brand} home`}>
          <span className="app-brand__orbit" aria-hidden="true" />
          <span>{brand}</span>
        </a>
        <nav className="app-navigation" aria-label="Primary navigation">
          {model.main.map((item) => (
            <NavLink item={item} key={item.href} />
          ))}
          {model.areas.map((area) => (
            <a
              className="app-nav-link"
              data-current={model.active === area ? "true" : undefined}
              href={area.href}
              key={area.area}
            >
              {area.label}
            </a>
          ))}
        </nav>
        <div className="app-header__tools">
          <HeaderStatusSlot />
          <AccountMenu items={model.account} />
          <HeaderSlot />
          <NavMenu model={model} />
        </div>
      </header>
      <div
        className="app-body"
        data-sidebar={sidebarArea === null ? undefined : "true"}
      >
        {sidebarArea === null ? null : <AreaSidebar area={sidebarArea} />}
        <main id="main-content" tabIndex={-1}>
          <Breadcrumbs crumbs={model.breadcrumb} />
          {children}
        </main>
      </div>
      <footer className="app-footer">
        <span>{footerLabel}</span>
        <nav aria-label="More">
          {model.footer.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
          <a href="#top">Back to top</a>
        </nav>
      </footer>
      <div className="scanlines" aria-hidden="true" />
    </div>
  );
}
