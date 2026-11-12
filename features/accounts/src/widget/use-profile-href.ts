"use client";

import { createRequester, sameOriginFetch } from "@frostbite/client-http";
import {
  getMyProfileResponseSchema,
  getMyProfileRoute,
  myProfileHref,
  profileSetupPath,
} from "@frostbite/shared/profiles";
import { useEffect, useState } from "react";

// How long the menu waits to learn where "My profile" leads before it stays with the setup page.
export const profileHrefTimeoutMs = 5_000;

// Where the menu's "My profile" link goes. It leads to the setup page until the player's profile is read, and stays there if it cannot
// be: the setup page always works, whatever the profile is, so a slow or failed read never leaves the link dead.
export function useProfileHref(signedIn: boolean): string {
  const [href, setHref] = useState<string>(profileSetupPath);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    createRequester(sameOriginFetch)(
      getMyProfileRoute,
      getMyProfileResponseSchema,
      { signal: AbortSignal.timeout(profileHrefTimeoutMs) },
    ).then(
      ({ profile }) => {
        if (current) setHref(myProfileHref(profile));
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [signedIn]);
  return href;
}
