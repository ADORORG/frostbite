"use client";

import { returnTarget } from "@ador/shared/auth/sign-in-path";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { signInViews } from "./registry.ts";
import { selectSignInViews, type SignInView } from "./views.ts";

// A full navigation, so everything on the page (the header's wallet, the navigation) is read again under the new session.
const assign = (path: string): void => window.location.assign(path);

// Every way to sign in that the deployment offers, as a row of keys with the chosen one's panel beneath. What is offered comes from the
// server's method registry; `views` is how each kind is shown. Every panel stays mounted (the others are only hidden), so a half-entered
// email survives a look at another key and a method that finds the person already signed in still takes them on.
export function SignInSurface({
  expectedNetwork,
  navigate = assign,
  offered,
  views = signInViews,
}: {
  readonly expectedNetwork: WalletNetwork;
  // How to go to a page; the destination is checked by `returnTarget`, which only ever gives a path on this site.
  readonly navigate?: (path: string) => void;
  readonly offered: readonly string[];
  readonly views?: readonly SignInView[];
}) {
  const shown = selectSignInViews(offered, views);
  const [first] = shown;
  const [chosen, choose] = useState(first?.kind ?? "");
  const group = useId();
  const keys = useRef<Readonly<Record<string, HTMLButtonElement | null>>>({});
  if (first === undefined)
    return <p role="status">Signing in is not available right now.</p>;
  const current = shown.some(({ kind }) => kind === chosen)
    ? chosen
    : first.kind;
  // Arrow keys move between the keys as in any tab list, Home and End jump to the ends.
  function move(event: KeyboardEvent, index: number) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? shown.length - 1
          : step === undefined
            ? null
            : (index + step + shown.length) % shown.length;
    const kind = target === null ? undefined : shown[target]?.kind;
    if (kind === undefined) return;
    event.preventDefault();
    choose(kind);
    keys.current[kind]?.focus();
  }
  return (
    <div className="sign-in-console">
      <div
        aria-label="How do you want to sign in?"
        className="sign-in-keys"
        data-count={shown.length}
        role="tablist"
      >
        {shown.map(({ glyph, kind, label, tagline }, index) => (
          <button
            aria-controls={`${group}-${kind}`}
            aria-selected={kind === current}
            className="sign-in-key"
            id={`${group}-key-${kind}`}
            key={kind}
            onClick={() => choose(kind)}
            onKeyDown={(event) => move(event, index)}
            ref={(element) => {
              keys.current = { ...keys.current, [kind]: element };
            }}
            role="tab"
            tabIndex={kind === current ? 0 : -1}
            type="button"
          >
            <span aria-hidden="true" className="sign-in-key__glyph">
              {glyph}
            </span>
            <span className="sign-in-key__label" id={`${group}-name-${kind}`}>
              {label}
            </span>
            <small className="sign-in-key__tagline">{tagline}</small>
          </button>
        ))}
      </div>
      {shown.map(({ Component, kind, label }) => (
        <section
          aria-labelledby={`${group}-name-${kind}`}
          className="sign-in-slot"
          hidden={kind !== current}
          id={`${group}-${kind}`}
          key={kind}
          role="tabpanel"
        >
          <h2 className="sign-in-slot__title">{`${label} login`}</h2>
          <Component
            expectedNetwork={expectedNetwork}
            onSignedIn={() => navigate(returnTarget(window.location.search))}
          />
        </section>
      ))}
    </div>
  );
}
