"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// A dialog the page opens and closes itself, so it can be opened from anywhere (a header button, a game's request)
// and not only from a button of its own. The browser's modal dialog traps focus, closes on Escape and keeps the page
// behind it inert; `onClose` runs however it closed, so the page's state never disagrees with what is on screen.
export function ArcadeDialog({
  children,
  onClose,
  open,
  title,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      aria-labelledby={titleId}
      className="arcade-modal"
      onClose={onClose}
      ref={dialog}
    >
      <header className="arcade-modal__header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="arcade-button arcade-button--cyan"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </header>
      <div className="arcade-modal__body">{children}</div>
    </dialog>
  );
}
