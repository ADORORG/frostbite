"use client";

import { ArcadeActionButton } from "@repo/ui/arcade";

import { profileCopy } from "../domain/copy.ts";

// The setup page while the player's profile is on its way: blocks the size of the cards that come, so nothing jumps when they arrive.
export function SetupSkeleton() {
  return (
    <div aria-busy="true" className="profile-skeleton">
      <div className="profile-skeleton__block" />
      <div className="profile-skeleton__block" />
      <div className="profile-skeleton__block" />
    </div>
  );
}

// The profile could not be loaded: said plainly, with one way forward.
export function SetupFailed({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <section className="profile-notice" data-tone="bad" role="alert">
      <p>{profileCopy.setup.errors.load}</p>
      <ArcadeActionButton onClick={onRetry} size="small">
        {profileCopy.setup.errors.retry}
      </ArcadeActionButton>
    </section>
  );
}
