import { ApiError } from "@frostbite/client-http";
import type { MintedMilestone } from "@frostbite/shared/games";
import { useEffect, useState } from "react";

import { createMintedApi, type MintedApi } from "../client/minted-api.ts";

// What the page knows of the player's mints: still asking, the list, nobody signed in, or the platform could not be reached.
export type MintedState =
  | { readonly kind: "failed" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly minted: readonly MintedMilestone[] }
  | { readonly kind: "signed-out" };

export function useMinted(api?: MintedApi): MintedState {
  const [state, setState] = useState<MintedState>({ kind: "loading" });
  useEffect(() => {
    let current = true;
    (api ?? createMintedApi())
      .list()
      .then(({ minted }) => current && setState({ kind: "ready", minted }))
      .catch(
        (error: unknown) =>
          current &&
          setState({
            kind:
              error instanceof ApiError && error.code === "unauthorized"
                ? "signed-out"
                : "failed",
          }),
      );
    return () => {
      current = false;
    };
  }, [api]);
  return state;
}
