import type { ClaimsService } from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import type { GameClaimState, GameMilestone } from "@ador/shared/games";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { createClaimsApi, type ClaimsApi } from "../client/claims-api.ts";
import type { ClaimFeeSettings } from "../wallet-config.ts";
import { createClaimsService } from "../client/claims-port.ts";
import { useClaims, type ClaimSigner } from "./use-claims.ts";

export interface PlayerClaims {
  readonly api?: ClaimsApi;
  // How the claim's fee speed is offered; absent, no choice is made and claims use the platform's usual speed.
  readonly fees?: ClaimFeeSettings;
  readonly pollMs?: number;
  readonly sign?: ClaimSigner;
  readonly wallet: WalletInfo | null;
}

// The player's claims for a game page: the claims themselves, and the pieces the game's session needs from them (the claims
// service the game asks through, which shows the claim it started, and a way to tell the game how a claim goes). The session
// is made after the claims it starts, so the telling is connected afterwards.
export function usePlayerClaims(
  milestones: readonly GameMilestone[],
  gameId: string,
  claims: PlayerClaims | undefined,
  claimsFor:
    | ((gameId: string, wallet: () => WalletInfo | null) => ClaimsService)
    | undefined,
) {
  const api = useMemo(() => claims?.api ?? createClaimsApi(), [claims?.api]);
  const tell = useRef<(milestoneId: string, state: GameClaimState) => void>(
    () => undefined,
  );
  const ui = useClaims({
    api,
    enabled: claims !== undefined,
    feeSpeed: claims?.fees?.defaultSpeed,
    gameId,
    onChange: (milestoneId, state) => tell.current(milestoneId, state),
    pollMs: claims?.pollMs,
    sign: claims?.sign,
    wallet: claims?.wallet ?? null,
  });
  const { begin, refuse } = ui;
  // The speed the player has picked, read when the game asks for a claim (the game cannot see or choose it).
  const claimSpeed = useRef(ui.feeSpeed);
  useEffect(() => {
    claimSpeed.current = ui.feeSpeed;
  }, [ui.feeSpeed]);
  // The wallet the page claims with is its own to read, not the game's: a game that did not declare the wallet capability is told
  // of none, yet its milestones can still be claimed with the player's connected wallet. Read when a claim is asked for.
  const claimWallet = useRef(claims?.wallet ?? null);
  const current = claims?.wallet ?? null;
  useEffect(() => {
    claimWallet.current = current;
  }, [current]);
  const titles = useMemo(
    () => Object.fromEntries(milestones.map(({ id, title }) => [id, title])),
    [milestones],
  );
  return {
    // How the game asks for a claim: the page's own unless a test supplies another; none when claims are not offered.
    claimsFor:
      claimsFor ??
      (claims === undefined
        ? undefined
        : (id: string) =>
            createClaimsService({
              api,
              feeSpeed: () => claimSpeed.current ?? undefined,
              gameId: id,
              onRefused: refuse,
              onStarted: begin,
              wallet: () => claimWallet.current,
            })),
    // Connects how the game is told a claim changed, once the session exists.
    bindTelling: useCallback(
      (emit: (milestoneId: string, state: GameClaimState) => void) => {
        tell.current = emit;
      },
      [],
    ),
    titles,
    ui,
  };
}
