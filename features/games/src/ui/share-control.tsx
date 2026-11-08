"use client";

import type { ShareConfig } from "@frostbite/share";
import { ShareButton } from "@frostbite/share/react";
import type { CreateShareInput } from "@frostbite/shared/games";
import { useCallback, useMemo, type ReactNode } from "react";

import { createSharesApi, type SharesApi } from "../client/shares-api.ts";

// The address a link is opened at: the path the platform gave, on the origin this page is on (the public one, behind any proxy).
const absolute = (path: string) => new URL(path, window.location.origin).href;

// Sharing one thing the player earned. The link is made when the control is opened, from the account's own records, and the words that
// go with it are the game's and the player's, never anything about who they are. Without a configuration there is no control: sharing
// is switched on by supplying one.
export function ShareControl({
  api,
  art,
  config,
  heading,
  kicker,
  request,
  text,
  variant,
}: {
  readonly api?: SharesApi | undefined;
  // A picture of what is shared, and what it is called, for the sheet's header.
  readonly art?: ReactNode;
  readonly config?: ShareConfig | undefined;
  readonly heading: string;
  readonly kicker: string;
  readonly request: CreateShareInput;
  readonly text: string;
  readonly variant?: "button" | "chip" | "icon";
}) {
  const shares = useMemo(() => api ?? createSharesApi(), [api]);
  // The control asks for its link when it opens, and again if this function changes, so `request` must be the same object for the same
  // thing (a constant, or made with `useMemo`).
  const makeLink = useCallback(async () => {
    const answer = await shares.create(request);
    return answer.status === "shared" ? absolute(answer.path) : null;
  }, [request, shares]);
  if (config === undefined) return null;
  return (
    <ShareButton
      {...(art === undefined ? {} : { art })}
      config={config}
      heading={heading}
      kicker={kicker}
      makeLink={makeLink}
      text={text}
      {...(variant === undefined ? {} : { variant })}
    />
  );
}
