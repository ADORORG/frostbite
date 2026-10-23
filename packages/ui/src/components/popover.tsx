"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface PopoverProps {
  readonly align?: "end" | "start";
  // The panel. A function receives `close`, for a button inside the panel that finishes the job (choosing something, signing out).
  // Without a panel (null) the trigger is a plain button that calls `onTrigger`, so a control can be a menu only when it has one.
  readonly children: ReactNode | ((panel: { close: () => void }) => ReactNode);
  // What the panel is called to someone who cannot see it.
  readonly label: string;
  readonly onTrigger?: () => void;
  // Extra classes for the panel, for one that needs more room than a menu.
  readonly panelClassName?: string;
  readonly trigger: ReactNode;
  readonly triggerClassName?: string;
  // The trigger's name when its content is not words (an icon, a dot).
  readonly triggerLabel?: string;
  // The trigger shows it is working (for example while a remembered wallet comes back).
  readonly busy?: boolean;
  // Extra attributes for the trigger, for a state the page styles (a wrong network).
  readonly triggerData?: Readonly<Record<`data-${string}`, string | undefined>>;
}

// A button that opens a panel under it: the one way the header (and any bar) offers a menu or a small panel, so each behaves the
// same. It closes on Escape (putting focus back on the button), on a press anywhere else, and on `close`. On a narrow screen the panel
// becomes a sheet the width of the screen, hung from the bar (not fixed to the screen: a bar with a blurred background would trap
// a fixed panel inside itself).
export function Popover({
  align = "end",
  busy = false,
  children,
  label,
  onTrigger,
  panelClassName,
  trigger,
  triggerClassName = "popover__trigger",
  triggerData,
  triggerLabel,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const hasPanel = children !== null && children !== undefined;
  const shown = open && hasPanel;
  useEffect(() => {
    if (!shown) return;
    const away = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        root.current !== null &&
        !root.current.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [shown]);
  const close = () => setOpen(false);
  return (
    <div
      className="popover"
      data-align={align}
      data-open={shown ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && shown) {
          close();
          button.current?.focus();
        }
      }}
      ref={root}
    >
      <button
        aria-busy={busy ? true : undefined}
        aria-controls={hasPanel ? panelId : undefined}
        aria-expanded={hasPanel ? shown : undefined}
        aria-haspopup={hasPanel ? "dialog" : undefined}
        aria-label={triggerLabel}
        className={triggerClassName}
        onClick={() => (hasPanel ? setOpen(!shown) : onTrigger?.())}
        ref={button}
        type="button"
        {...triggerData}
      >
        {trigger}
      </button>
      {shown ? (
        <div
          aria-label={label}
          className={`popover__panel ${panelClassName ?? ""}`.trim()}
          id={panelId}
          role="dialog"
        >
          {typeof children === "function" ? children({ close }) : children}
        </div>
      ) : null}
    </div>
  );
}
