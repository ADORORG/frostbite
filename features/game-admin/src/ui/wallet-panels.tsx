"use client";

import { useStepWallet } from "@frostbite/wallet/client";

import type { GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { GameAdminPanel } from "./game-admin-panel.tsx";
import { TemplatesPanel } from "./templates-panel.tsx";

// The panels over the wallet the person has connected in the app's header: its address is offered as the one to sign with, and the
// Sign button signs with it, if it is one of the wallets this deployment allows for signing steps.
export function WalletTemplatesPanel({
  api,
  signingWallets,
}: {
  readonly api?: GameAdminApi;
  readonly signingWallets: readonly string[];
}) {
  const wallet = useStepWallet(signingWallets);
  return (
    <TemplatesPanel
      {...(api === undefined ? {} : { api })}
      connectedAddress={wallet.address}
      {...(wallet.sign === undefined ? {} : { sign: wallet.sign })}
    />
  );
}

export function WalletGamePanel({
  api,
  game,
  signingWallets,
}: {
  readonly api?: GameAdminApi;
  readonly game: AdminGameInfo;
  readonly signingWallets: readonly string[];
}) {
  const wallet = useStepWallet(signingWallets);
  return (
    <GameAdminPanel
      {...(api === undefined ? {} : { api })}
      connectedAddress={wallet.address}
      game={game}
      {...(wallet.sign === undefined ? {} : { sign: wallet.sign })}
    />
  );
}
