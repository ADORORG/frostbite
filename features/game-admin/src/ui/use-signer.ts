import type { FeeSpeed } from "@frostbite/shared/chain";
import { useState } from "react";

import { useFeeSettings } from "./fee-settings.tsx";
import type { StartContext } from "./use-admin-steps.ts";

// Who will sign: the wallet address staff sign with and, where the network's steps must present the game's token, where that token
// is held, and how fast they want steps confirmed. The context is what every step started from the page is built for.
// The address starts as the connected wallet's, if one is connected, and staff may change it.
export function useSigner(connectedAddress = "") {
  const [typed, setWallet] = useState<string | null>(null);
  const fees = useFeeSettings();
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed | null>(
    fees?.defaultSpeed ?? null,
  );
  const wallet = typed ?? connectedAddress;
  const [authToken, setAuthToken] = useState("");
  const context: StartContext = {
    authTokenOutput: authToken.trim(),
    ...(feeSpeed === null ? {} : { feeSpeed }),
    wallet: wallet.trim(),
  };
  return {
    authToken,
    context,
    feeSpeed,
    ready: context.wallet !== "",
    setAuthToken,
    setFeeSpeed,
    setWallet,
    wallet,
  };
}

export type Signer = ReturnType<typeof useSigner>;
