"use client";

import { useState, type ReactNode } from "react";

import type { ShareConfig } from "./config.ts";
import { shareControlCopy } from "./copy.ts";
import { ShareGlyph } from "./glyph.tsx";
import { ShareSheet } from "./share-sheet.tsx";

// A small, optional Share control. Pressing it opens a sheet (a bottom sheet on a phone) over the page, so it never makes the thing it sits on
// longer, and nothing opens by itself. The sheet makes the link when it opens, then shows what is being shared, a tile for each destination,
// and the link to copy. What is shared is the words and the link only; the control knows nothing about who is sharing.
//
// `makeLink` must be a stable function for the same thing (the sheet asks again if it changes).
export function ShareButton({
  art,
  config,
  heading,
  kicker,
  makeLink,
  text,
  variant = "button",
}: {
  // A picture of what is being shared, for the sheet's header.
  readonly art?: ReactNode;
  readonly config: ShareConfig;
  // What is being shared, in a few words, and the small line above it.
  readonly heading: string;
  readonly kicker: string;
  readonly makeLink: () => Promise<string | null>;
  readonly text: string;
  // `icon` is a round button with the mark alone, to sit over a picture.
  readonly variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label={variant === "icon" ? shareControlCopy.button : undefined}
        className="share-trigger"
        data-variant={variant}
        onClick={() => setOpen(true)}
        type="button"
      >
        <ShareGlyph />
        {variant === "icon" ? null : <span>{shareControlCopy.button}</span>}
      </button>
      <ShareSheet
        art={art}
        config={config}
        heading={heading}
        kicker={kicker}
        makeLink={makeLink}
        onClose={() => setOpen(false)}
        open={open}
        text={text}
      />
    </>
  );
}
