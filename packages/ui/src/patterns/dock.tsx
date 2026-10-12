"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

export interface DockSection {
  // A short label for the button, and for the panel it opens.
  readonly label: string;
  // A small figure beside the label ("1/3"), or null.
  readonly badge: string | null;
  readonly content: ReactNode;
  readonly id: string;
}

// A slim strip that stays at the bottom of the screen while its page is in view, with a button for each
// section. A section opens upward over the page, one at a time, and closes with its button, the Hide button,
// Escape, or by clicking into the game (a frame takes focus from the page). Closed, it costs one line.
export function ArcadeDock({
  label,
  sections,
}: {
  readonly label: string;
  readonly sections: readonly DockSection[];
}) {
  const base = useId();
  const [open, setOpen] = useState<string | null>(null);
  const buttonId = (id: string) => `${base}-button-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  useEffect(() => {
    if (open === null) return undefined;
    // Focus moving into a frame is the only way the page learns the player went back to the game.
    const onBlur = () => {
      if (document.activeElement?.tagName === "IFRAME") setOpen(null);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [open]);

  return (
    <div
      className="arcade-dock"
      data-open={open !== null}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || open === null) return;
        event.stopPropagation();
        document.getElementById(buttonId(open))?.focus();
        setOpen(null);
      }}
      role="presentation"
    >
      {sections.map((section) => (
        // The content names itself (a card with a heading), so the panel adds no second region of the same name.
        <div
          className="arcade-dock__panel"
          hidden={open !== section.id}
          id={panelId(section.id)}
          key={section.id}
        >
          {section.content}
        </div>
      ))}
      <div aria-label={label} className="arcade-dock__strip" role="group">
        {sections.map((section) => (
          <button
            aria-controls={panelId(section.id)}
            aria-expanded={open === section.id}
            className="arcade-dock__button"
            id={buttonId(section.id)}
            key={section.id}
            onClick={() => setOpen(open === section.id ? null : section.id)}
            type="button"
          >
            {section.label}
            {section.badge === null ? null : (
              <span className="arcade-dock__badge">{section.badge}</span>
            )}
          </button>
        ))}
        {open === null ? null : (
          <button
            className="arcade-dock__button arcade-dock__hide"
            onClick={() => setOpen(null)}
            type="button"
          >
            Hide
          </button>
        )}
      </div>
    </div>
  );
}
