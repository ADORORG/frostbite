"use client";

import type { ShareConfig } from "@frostbite/share";
import { ShareButton } from "@frostbite/share/react";
import type { CreateShareInput } from "@frostbite/shared/games";
import { useCallback, useMemo } from "react";

import { createSharesApi, type SharesApi } from "../client/shares-api.ts";

// The address a link is opened at: the path the platform gave, on the origin this page is on (the public one, behind any proxy).
const absolute = (path: string) => new URL(path, window.location.origin).href;

// Sharing one thing the player earned. The link is made when the control is opened, from the account's own records, and the words that
// go with it are the game's and the player's, never anything about who they are. Without a configuration there is no control: sharing
// is switched on by supplying one.
export function ShareControl({
  api,
  config,
  request,
  text,
}: {
  readonly api?: SharesApi | undefined;
  readonly config?: ShareConfig | undefined;
  readonly request: CreateShareInput;
  readonly text: string;
}) {
  const shares = useMemo(() => api ?? createSharesApi(), [api]);
  // The control asks for its link when it opens, and again if this function changes, so `request` must be the same object for the same
  // thing (a constant, or made with `useMemo`).
  const makeLink = useCallback(async () => {
    const answer = await shares.create(request);
    return answer.status === "shared" ? absolute(answer.path) : null;
  }, [request, shares]);
  if (config === undefined) return null;
  return <ShareButton config={config} makeLink={makeLink} text={text} />;
}
