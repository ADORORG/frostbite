"use client";

import { ArcadeDialog } from "@repo/ui/arcade";
import { useEffect, useState, type ReactNode } from "react";

import type { ShareConfig } from "./config.ts";
import { readableOn } from "./colour.ts";
import { shareControlCopy } from "./copy.ts";
import { platformLink } from "./links.ts";

type LinkState =
  | { readonly kind: "failed" }
  | { readonly kind: "preparing" }
  | { readonly kind: "ready"; readonly url: string };

// Whether this device offers its own share sheet and is one a finger holds: there the sheet is the first choice, because it already knows
// the apps the person uses. A desktop browser may offer one too, but a row of destinations is the clearer thing there.
function offersNativeSheet(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function Tiles({
  config,
  link,
  text,
}: {
  readonly config: ShareConfig;
  readonly link: LinkState;
  readonly text: string;
}) {
  const ready = link.kind === "ready";
  return (
    <ul
      aria-busy={link.kind === "preparing"}
      aria-label={shareControlCopy.sheetTitle}
      className="share-tiles"
    >
      {ready && offersNativeSheet() ? (
        <li>
          <button
            className="share-tile share-tile--native"
            onClick={() =>
              // A person closing the sheet is not a failure; there is nothing to say either way.
              void navigator
                .share({
                  text,
                  title: shareControlCopy.nativeTitle,
                  url: link.url,
                })
                .catch(() => undefined)
            }
            type="button"
          >
            <span className="share-tile__mark">⤴</span>
            <span className="share-tile__label">
              {shareControlCopy.nativeTitle}
            </span>
          </button>
        </li>
      ) : null}
      {config.platforms.map((platform) => {
        const face = (
          <>
            <span
              className="share-tile__mark"
              data-ink={readableOn(platform.accent)}
              style={{ background: platform.accent }}
            >
              {platform.mark}
            </span>
            <span className="share-tile__label">{platform.label}</span>
          </>
        );
        return (
          <li key={platform.id}>
            {link.kind === "ready" ? (
              <a
                aria-label={shareControlCopy.opensNewTab(platform.label)}
                className="share-tile"
                href={platformLink(platform, {
                  hashtags: config.hashtags,
                  text,
                  url: link.url,
                })}
                rel="noopener noreferrer"
                target="_blank"
              >
                {face}
              </a>
            ) : (
              <span aria-hidden="true" className="share-tile" data-waiting>
                {face}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CopyRow({ url }: { readonly url: string }) {
  const [copied, setCopied] = useState<"done" | "failed" | "idle">("idle");
  return (
    <>
      <div className="share-link">
        <input
          aria-label={shareControlCopy.linkLabel}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={url}
        />
        <button
          data-copied={copied === "done" ? "true" : undefined}
          onClick={() =>
            void navigator.clipboard.writeText(url).then(
              () => setCopied("done"),
              () => setCopied("failed"),
            )
          }
          type="button"
        >
          {copied === "done" ? "✓" : shareControlCopy.copy}
        </button>
      </div>
      <p aria-live="polite" className="share-note" role="status">
        {copied === "done"
          ? shareControlCopy.copied
          : copied === "failed"
            ? shareControlCopy.copyFailed
            : ""}
      </p>
    </>
  );
}

function SheetBody({
  art,
  config,
  heading,
  kicker,
  makeLink,
  text,
}: {
  readonly art?: ReactNode;
  readonly config: ShareConfig;
  readonly heading: string;
  readonly kicker: string;
  readonly makeLink: () => Promise<string | null>;
  readonly text: string;
}) {
  const [link, setLink] = useState<LinkState>({ kind: "preparing" });
  useEffect(() => {
    let current = true;
    makeLink().then(
      (url) => {
        if (current)
          setLink(url === null ? { kind: "failed" } : { kind: "ready", url });
      },
      () => {
        if (current) setLink({ kind: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [makeLink]);
  return (
    <div className="share-sheet">
      <div className="share-ticket">
        {art === undefined ? null : (
          <span className="share-ticket__art">{art}</span>
        )}
        <span className="share-ticket__words">
          <small>{kicker}</small>
          <strong>{heading}</strong>
        </span>
      </div>
      <Tiles config={config} link={link} text={text} />
      {link.kind === "ready" ? <CopyRow url={link.url} /> : null}
      {link.kind === "preparing" ? (
        <p className="share-note" role="status">
          {shareControlCopy.preparing}
        </p>
      ) : null}
      {link.kind === "failed" ? (
        <p className="share-note" role="alert">
          {shareControlCopy.linkFailed}
        </p>
      ) : null}
    </div>
  );
}

// The sheet itself. Its body is only made while it is open, so the link is asked for when the person asks to share and not before.
export function ShareSheet({
  onClose,
  open,
  ...body
}: {
  readonly art?: ReactNode;
  readonly config: ShareConfig;
  readonly heading: string;
  readonly kicker: string;
  readonly makeLink: () => Promise<string | null>;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly text: string;
}) {
  return (
    <ArcadeDialog
      onClose={onClose}
      open={open}
      sheet
      title={shareControlCopy.sheetTitle}
    >
      {open ? <SheetBody {...body} /> : null}
    </ArcadeDialog>
  );
}
