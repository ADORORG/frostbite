"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// A dialog the page opens and closes itself, so it can be opened from anywhere (a header button, a game's request)
// and not only from a button of its own. The browser's modal dialog traps focus, closes on Escape and keeps the page
// behind it inert; `onClose` runs however it closed, so the page's state never disagrees with what is on screen.
export function ArcadeDialog({
  children,
  footer,
  onClose,
  open,
  title,
  wide = false,
}: {
  readonly children: ReactNode;
  // What stays in view under a long body: the buttons that finish the job.
  readonly footer?: ReactNode;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
  // For a dialog with a summary to read, not a short choice.
  readonly wide?: boolean;
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
      className={wide ? "arcade-modal arcade-modal--wide" : "arcade-modal"}
      onClose={onClose}
      ref={dialog}
    >
      {/* A plain row, not a <header>: the dialog is opened from the page's own header, and a header inside it would
          be a second banner landmark. */}
      <div className="arcade-modal__header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="arcade-button arcade-button--cyan"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      <div className="arcade-modal__body">{children}</div>
      {footer === undefined ? null : (
        <div className="arcade-modal__footer">{footer}</div>
      )}
    </dialog>
  );
}
