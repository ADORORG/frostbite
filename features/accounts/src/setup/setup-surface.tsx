"use client";

import {
  createRequester,
  sameOriginFetch,
  type Requester,
} from "@ador/client-http";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SignInSurface } from "../sign-in/sign-in-surface.tsx";
import type { SignInView } from "../sign-in/views.ts";
import {
  redeemSavedToken,
  tokenFromAddress,
  type SetupState,
  type TokenStore,
} from "./setup-flow.ts";
import { redeemSetupLinkResponseSchema, setupLinkRoutes } from "./contract.ts";
import { createSessionTokenStore } from "./token-store.ts";

// Where the address's `#token` goes once it has been saved: out of the address bar, history and any copy of the link.
const forgetAddressFragment = (): void =>
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );

// Opening a setup link: the token is moved out of the address, then the page opens the link for whoever is signed in, asks them to
// sign in if nobody is, and says what happened. It never claims administrator rights before the server has granted them.
export function SetupSurface({
  expectedNetwork,
  offered,
  request: send,
  store,
  views,
}: {
  readonly expectedNetwork: WalletNetwork;
  readonly offered: readonly string[];
  // How the page talks to the server, and where the token waits, and how each method is shown: the browser's own by default.
  readonly request?: Requester;
  readonly store?: TokenStore;
  readonly views?: readonly SignInView[];
}) {
  const tokens = useMemo(() => store ?? createSessionTokenStore(), [store]);
  const [state, setState] = useState<SetupState>({ kind: "checking" });
  // Opens the saved link and gives the state to show; the caller decides when to show it.
  const run = useCallback((): Promise<SetupState> => {
    const request = send ?? createRequester(sameOriginFetch);
    return redeemSavedToken({
      redeem: (token) =>
        request(setupLinkRoutes.redeem, redeemSetupLinkResponseSchema, {
          body: { token },
        }),
      store: tokens,
    });
  }, [send, tokens]);
  const retry = useCallback(() => void run().then(setState), [run]);
  useEffect(() => {
    const fromAddress = tokenFromAddress(window.location.hash);
    if (fromAddress !== null) {
      tokens.write(fromAddress);
      forgetAddressFragment();
    }
    let current = true;
    void run().then((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
    };
  }, [run, tokens]);

  switch (state.kind) {
    case "checking":
      return <p role="status">Opening your setup link…</p>;
    case "no-link":
      return (
        <p role="status">
          There is no setup link here. Ask the person running the platform for a
          new one.
        </p>
      );
    case "invalid":
      return (
        <p role="alert">
          This setup link is not valid, or it has expired. Ask for a new one.
        </p>
      );
    case "done":
      return (
        <p role="status">
          You are now an administrator. Open the admin area to continue.
        </p>
      );
    case "needs-method":
      return <p role="alert">{state.message}</p>;
    case "failed":
      return (
        <>
          <p role="alert">{state.message}</p>
          <button onClick={retry} type="button">
            Try again
          </button>
        </>
      );
    case "sign-in":
      return (
        <>
          <p>
            Sign in to finish setting up. Use the account that will administer
            the platform.
          </p>
          <SignInSurface
            expectedNetwork={expectedNetwork}
            navigate={retry}
            offered={offered}
            views={views}
          />
        </>
      );
  }
}
