"use client";

import type { ShareConfig } from "@frostbite/share";
import type { ProfileView } from "@frostbite/shared/profiles";

import { profileCopy } from "../domain/copy.ts";
import { SavedPanel } from "./saved-panel.tsx";
import type { Outcome } from "./use-profile-setup.ts";

// What the last save or delete did, in words: the "you're on the map" panel, or why a save was turned down, or that something went wrong.
export function SetupOutcome({
  bounds,
  outcome,
  saved,
  share,
}: {
  readonly bounds: { readonly maxLength: number; readonly minLength: number };
  readonly outcome: Outcome | null;
  readonly saved: ProfileView | null;
  readonly share?: ShareConfig | undefined;
}) {
  if (outcome === null) return null;
  const { errors, delete: removal } = profileCopy.setup;
  switch (outcome.kind) {
    case "saved":
      return saved === null ? null : (
        <SavedPanel profile={saved} share={share} />
      );
    case "deleted":
      return (
        <p className="profile-notice" role="status">
          {removal.done}
        </p>
      );
    case "failed":
      return (
        <p className="profile-notice" data-tone="bad" role="alert">
          {outcome.what === "save" ? errors.save : errors.remove}
        </p>
      );
    case "refused": {
      const { reason, refusal, until } = outcome.refusal;
      const text =
        refusal === "name-taken"
          ? profileCopy.nameStatus.taken
          : refusal === "name-locked" && until !== null
            ? profileCopy.nameStatus.locked(until)
            : profileCopy.nameReason(reason ?? "blocked", bounds);
      return (
        <p className="profile-notice" data-tone="bad" role="alert">
          {text}
        </p>
      );
    }
  }
}
