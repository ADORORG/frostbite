import type { ReactNode } from "react";

import { Avatar } from "../components/avatar.tsx";
import { StatusLamp, type StatusTone } from "../arcade/status-lamp.tsx";
import { AppShell, type ShellNavigationItem } from "./app-shell.tsx";

// The frame for a page a signed-in person manages something on (their account, the staff console): the platform shell around a "player
// card" header (a picture, what the page is, one line on it, and whether the session is live) and a grid of cards beneath. The same
// language as the sign-in page, so signing in and then managing an account read as one place. The layout lives here once and the words
// stay with the feature, as with `PageFrame`.
export function ConsolePage({
  avatarSeed,
  children,
  eyebrow,
  heading,
  intro,
  navigation,
  status,
}: {
  // Text the header's picture is drawn from (an account id, a wallet address); none, no picture.
  readonly avatarSeed?: string;
  readonly children: ReactNode;
  readonly eyebrow: string;
  // What the footer says; a console page is a signed-in workspace, and says so unless it has something more particular.
  readonly heading: string;
  readonly intro: string;
  readonly navigation: readonly ShellNavigationItem[];
  readonly status?: { readonly label: string; readonly tone: StatusTone };
}) {
  return (
    <AppShell homeHref="/" navigation={navigation}>
      <section className="console-page">
        <header className="console-hero">
          {avatarSeed === undefined ? null : (
            <span className="console-hero__picture">
              <Avatar seed={avatarSeed} size={72} />
            </span>
          )}
          <div className="console-hero__text">
            <p className="arcade-eyebrow">{eyebrow}</p>
            <h1>{heading}</h1>
            <p className="console-hero__lead">{intro}</p>
            {status === undefined ? null : (
              <StatusLamp label={status.label} tone={status.tone} />
            )}
          </div>
        </header>
        <div className="console-grid">{children}</div>
      </section>
    </AppShell>
  );
}

// One card of the grid: a symbol, what it is, how many there are (when there is a count worth showing), and its contents. A card that
// is a whole row of the grid (`wide`) is for a form or a table that needs the width.
export function ConsoleCard({
  children,
  count,
  glyph,
  lead,
  title,
  wide = false,
}: {
  readonly children: ReactNode;
  readonly count?: number;
  // One symbol for the card's key; decoration, hidden from assistive technology.
  readonly glyph: string;
  // One line on what this card is for.
  readonly lead?: string;
  readonly title: string;
  readonly wide?: boolean;
}) {
  return (
    <section className="console-card" data-wide={wide ? "true" : undefined}>
      <header className="console-card__head">
        <span aria-hidden="true" className="console-card__glyph">
          {glyph}
        </span>
        <div className="console-card__title">
          <h2>{title}</h2>
          {lead === undefined ? null : <p>{lead}</p>}
        </div>
        {count === undefined ? null : (
          <span
            aria-label={`${String(count)} in total`}
            className="console-card__count"
          >
            {count}
          </span>
        )}
      </header>
      <div className="console-card__body">{children}</div>
    </section>
  );
}

// A row of a card's list: a picture or symbol, a name with a line under it, and what can be done to it.
export function ConsoleRow({
  action,
  detail,
  leading,
  name,
}: {
  readonly action?: ReactNode;
  readonly detail?: ReactNode;
  readonly leading?: ReactNode;
  readonly name: ReactNode;
}) {
  return (
    <li className="console-row">
      {leading === undefined ? null : (
        <span className="console-row__leading">{leading}</span>
      )}
      <span className="console-row__text">
        <span className="console-row__name">{name}</span>
        {detail === undefined ? null : (
          <small className="console-row__detail">{detail}</small>
        )}
      </span>
      {action === undefined ? null : (
        <span className="console-row__action">{action}</span>
      )}
    </li>
  );
}
