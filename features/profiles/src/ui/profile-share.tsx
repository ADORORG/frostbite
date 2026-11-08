"use client";

import type { ShareConfig } from "@frostbite/share";
import { ShareButton } from "@frostbite/share/react";
import { profilePath } from "@frostbite/shared/profiles";
import { useCallback } from "react";

import { profileCopy } from "../domain/copy.ts";

// Share a profile page: the link is the page's own address on the origin the page is on, so it needs no record of its own.
export function ProfileShare({
  config,
  name,
}: {
  readonly config: ShareConfig;
  readonly name: string;
}) {
  const path = profilePath(name);
  const makeLink = useCallback(
    async () => new URL(path, window.location.origin).href,
    [path],
  );
  const { share } = profileCopy.page;
  return (
    <ShareButton
      config={config}
      heading={share.heading(name)}
      kicker={share.kicker}
      makeLink={makeLink}
      text={share.text(name)}
    />
  );
}
