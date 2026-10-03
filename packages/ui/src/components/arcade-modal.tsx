"use client";

import { useId, useRef, useSyncExternalStore, type ReactNode } from "react";

// Keep server-rendered triggers disabled until their handlers are attached.
const subscribeToHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export function ArcadeModal({
  children,
  title,
  triggerLabel,
}: {
  readonly children: ReactNode;
  readonly title: string;
  readonly triggerLabel: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientHydrated,
    serverHydrated,
  );
  return (
    <>
      <button
        className="arcade-button arcade-button--cyan"
        type="button"
        disabled={!hydrated}
        onClick={() => dialog.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog ref={dialog} className="arcade-modal" aria-labelledby={titleId}>
        <header className="arcade-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="arcade-button arcade-button--cyan"
            type="button"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </header>
        <div className="arcade-modal__body">{children}</div>
      </dialog>
    </>
  );
}
