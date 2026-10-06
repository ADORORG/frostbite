import type { ReactNode } from "react";

import { ArcadeButton, type ArcadeTone } from "../primitives/arcade-button.tsx";

export interface ShellNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly tone?: ArcadeTone;
}

interface AppShellProps {
  readonly brand: string;
  readonly children: ReactNode;
  readonly footerLabel: string;
  readonly homeHref: string;
  readonly navigation: readonly ShellNavigationItem[];
  readonly notices: readonly string[];
}

export function AppShell({
  brand,
  children,
  footerLabel,
  homeHref,
  navigation,
  notices,
}: AppShellProps) {
  return (
    <div className="app-shell" id="top">
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
          {navigation.map((item) => (
            <ArcadeButton href={item.href} key={item.href} tone={item.tone}>
              {item.label}
            </ArcadeButton>
          ))}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="app-footer">
        <span>{footerLabel}</span>
        <a href="#top">Back to top</a>
      </footer>
      <div className="scanlines" aria-hidden="true" />
    </div>
  );
}
