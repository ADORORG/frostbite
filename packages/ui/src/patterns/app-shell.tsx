import type { ReactNode } from "react";

import { builderCredit, productName } from "../brand.ts";
import { BrandMark } from "../components/brand-mark.tsx";
import { AccountMenu } from "./account-menu.tsx";
import { AreaSidebar } from "./area-sidebar.tsx";
import { Breadcrumbs } from "./breadcrumbs.tsx";
import { HeaderHeight } from "./header-height.tsx";
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
  readonly children: ReactNode;
  readonly homeHref: string;
  // A page that is one thing to look at or play (a game) gives up the room around it, so that thing gets it.
  readonly immersive?: boolean;
  readonly navigation: readonly ShellNavigationItem[];
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
  children,
  homeHref,
  immersive = false,
  navigation,
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
      <header className="app-header">
        <a
          className="app-brand"
          href={homeHref}
          aria-label={`${productName} home`}
        >
          <BrandMark />
          <span>{productName}</span>
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
        <HeaderHeight />
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
        <div className="app-footer__about">
          <span>{productName}</span>
          <a
            className="app-footer__credit"
            href={builderCredit.href}
            rel="noopener"
          >
            {builderCredit.label}
          </a>
        </div>
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
