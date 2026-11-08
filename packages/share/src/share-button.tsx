"use client";

import { Popover } from "@repo/ui/arcade";
import { useEffect, useState } from "react";

import type { ShareConfig } from "./config.ts";
import { shareControlCopy } from "./copy.ts";
import { platformLink } from "./links.ts";

type LinkState =
  | { readonly kind: "failed" }
  | { readonly kind: "preparing" }
  | { readonly kind: "ready"; readonly url: string };

// Whether this device offers its own share sheet and is one a finger holds: there the sheet is the first choice, because it already knows
// the apps the person uses. A desktop browser may offer one too, but a menu of destinations is the clearer thing there.
function offersNativeSheet(): boolean {
  return (
    typeof navigator.share === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function SharePanel({
  config,
  makeLink,
  text,
}: {
  readonly config: ShareConfig;
  // Makes the link to share and gives its address, or null when it could not be made. Asked when the panel opens, not before, so a page
  // full of Share buttons makes no links until one is used.
  readonly makeLink: () => Promise<string | null>;
  readonly text: string;
}) {
  const [link, setLink] = useState<LinkState>({ kind: "preparing" });
  const [copied, setCopied] = useState<"failed" | "idle" | "done">("idle");
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
  if (link.kind === "preparing")
    return <p role="status">{shareControlCopy.preparing}</p>;
  if (link.kind === "failed")
    return <p role="alert">{shareControlCopy.linkFailed}</p>;
  const { url } = link;
  const content = { hashtags: config.hashtags, text, url };
  return (
    <>
      <ul aria-label={shareControlCopy.menu} className="menu-list">
        {offersNativeSheet() ? (
          <li>
            <button
              className="menu-link"
              onClick={() =>
                // A person closing the sheet is not a failure; there is nothing to say either way.
                void navigator
                  .share({ text, title: shareControlCopy.nativeTitle, url })
                  .catch(() => undefined)
              }
              type="button"
            >
              {shareControlCopy.nativeTitle}
            </button>
          </li>
        ) : null}
        {config.platforms.map((platform) => (
          <li key={platform.id}>
            <a
              aria-label={shareControlCopy.opensNewTab(platform.label)}
              className="menu-link"
              href={platformLink(platform, content)}
              rel="noopener noreferrer"
              target="_blank"
            >
              {platform.label}
            </a>
          </li>
        ))}
        <li>
          <button
            className="menu-link"
            onClick={() =>
              void navigator.clipboard.writeText(url).then(
                () => setCopied("done"),
                () => setCopied("failed"),
              )
            }
            type="button"
          >
            {shareControlCopy.copy}
          </button>
        </li>
      </ul>
      <p aria-live="polite" role="status">
        {copied === "done"
          ? shareControlCopy.copied
          : copied === "failed"
            ? shareControlCopy.copyFailed
            : ""}
      </p>
      {copied === "failed" ? <input readOnly value={url} /> : null}
    </>
  );
}

// A small, optional Share control. Pressing it opens a panel under the button (never a blocking dialog, and nothing opens by itself);
// the panel makes the link, then offers the device's own share sheet where there is one, the configured destinations, and a copy of the
// link. What is shared is the words and the link only; the control knows nothing about who is sharing.
export function ShareButton({
  config,
  makeLink,
  text,
}: {
  readonly config: ShareConfig;
  readonly makeLink: () => Promise<string | null>;
  readonly text: string;
}) {
  return (
    <Popover
      align="start"
      label={shareControlCopy.menu}
      trigger={shareControlCopy.button}
    >
      <SharePanel config={config} makeLink={makeLink} text={text} />
    </Popover>
  );
}
