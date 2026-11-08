"use client";

import type { ShareConfig } from "@frostbite/share";
import { profilePath, type ProfileView } from "@frostbite/shared/profiles";
import { ArcadeButton } from "@repo/ui/arcade";

import { profileCopy } from "../domain/copy.ts";
import { ProfileShare } from "./profile-share.tsx";

// Shown after a profile is saved: that the page is live (with its link, a way to open it and a way to share it), or that it is saved and
// still hidden.
export function SavedPanel({
  profile,
  share,
}: {
  readonly profile: ProfileView;
  readonly share?: ShareConfig | undefined;
}) {
  const path = profilePath(profile.name);
  const { saved } = profileCopy.setup;
  return (
    <section aria-live="polite" className="profile-saved" role="status">
      <h2 className="profile-saved__title">{saved.title}</h2>
      {profile.visible ? (
        <>
          <p>
            {saved.link} <span className="profile-saved__link">{path}</span>
          </p>
          <div className="profile-saved__actions">
            <ArcadeButton href={path} tone="mint">
              {saved.view}
            </ArcadeButton>
            {share === undefined ? null : (
              <ProfileShare config={share} name={profile.name} />
            )}
          </div>
        </>
      ) : (
        <p>{saved.hidden}</p>
      )}
    </section>
  );
}
