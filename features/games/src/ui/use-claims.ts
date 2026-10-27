import { ApiError } from "@ador/client-http";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import type { FeeSpeed } from "@ador/shared/chain";
import type {
  GameClaim,
  GameClaimState,
  GameClaimUnavailableReason,
} from "@ador/shared/games";
import { walletRefusedCopy } from "@ador/wallet/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ClaimsApi } from "../client/claims-api.ts";
import {
  claimSignerCopy,
  claimUnavailableCopy,
  isSettledClaim,
  unreachableCopy,
} from "../domain/claim-copy.ts";

// What the wallet is asked to sign, and what it gives back (the same transaction, signed). The platform page's wallet
// provides it; where the wallet cannot sign claims, there is none, and the page says so.
export type ClaimTransaction = NonNullable<GameClaim["toSign"]>;
export type ClaimSigner = (
  transaction: ClaimTransaction,
) => Promise<ClaimTransaction | null>;

// How often an unsettled claim is looked at.
export const defaultClaimPollMs = 4_000;

const submitRefusal = {
  "chain-unavailable": "The network could not be reached. Try signing again.",
  expired: "It was not signed in time. Start the claim again.",
  "invalid-signature":
    "What was signed is not what was shown. Nothing was sent.",
  "not-awaiting-signature": "This claim can no longer be signed.",
  "not-found": "This claim could not be found.",
} as const;

// A player's claims for one game: loaded, started (from a button here or by the game asking), reviewed and signed, and followed
// until they are over. The platform decides what each state means; this only shows it and tells the game when it changes.
export function useClaims(options: {
  readonly api: ClaimsApi;
  readonly enabled: boolean;
  readonly gameId: string;
  // Told when a claim's state changes, for the game (`claim.changed`).
  readonly onChange?: (milestoneId: string, state: GameClaimState) => void;
  // The speed claims are started at until the player picks another; none, the platform's usual speed.
  readonly feeSpeed?: FeeSpeed | undefined;
  readonly pollMs?: number;
  readonly sign?: ClaimSigner;
  readonly wallet: WalletInfo | null;
}) {
  const { api, enabled, gameId, onChange, sign, wallet } = options;
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed | null>(
    options.feeSpeed ?? null,
  );
  const pollMs = options.pollMs ?? defaultClaimPollMs;
  const [claims, setClaims] = useState<readonly GameClaim[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const known = useRef(new Map<string, GameClaimState>());
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  const upsert = useCallback((claim: GameClaim, announce: boolean) => {
    const before = known.current.get(claim.id);
    known.current.set(claim.id, claim.state);
    setClaims((held) =>
      held.some(({ id }) => id === claim.id)
        ? held.map((entry) => (entry.id === claim.id ? claim : entry))
        : [...held, claim],
    );
    if (announce && before !== claim.state)
      changed.current?.(claim.milestoneId, claim.state);
  }, []);

  // The claims already on the account, shown without telling the game anything about them.
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    api.list(gameId).then(
      ({ claims: held }) => {
        if (current) for (const claim of held) upsert(claim, false);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [api, enabled, gameId, upsert]);

  // Every claim that is not over is looked at until it is.
  const unsettled = useMemo(
    () =>
      claims.filter(({ state }) => !isSettledClaim(state)).map(({ id }) => id),
    [claims],
  );
  const watching = unsettled.join(",");
  useEffect(() => {
    if (watching === "") return;
    const timer = setInterval(() => {
      for (const claimId of watching.split(","))
        api.refresh(claimId).then(
          (answer) => {
            if (answer.status === "ok") upsert(answer.claim, true);
          },
          () => undefined,
        );
    }, pollMs);
    return () => clearInterval(timer);
  }, [api, pollMs, upsert, watching]);

  const begin = useCallback(
    (claim: GameClaim) => {
      upsert(claim, true);
      setActiveId(claim.id);
      setMessage(null);
    },
    [upsert],
  );

  const start = useCallback(
    async (milestoneId: string) => {
      if (wallet === null) return setMessage(claimUnavailableCopy["no-wallet"]);
      setMessage(null);
      try {
        const answer = await api.start({
          ...(feeSpeed === null ? {} : { feeSpeed }),
          gameId,
          milestoneId,
          wallet: wallet.address,
        });
        if (answer.status === "started") begin(answer.claim);
        else setMessage(claimUnavailableCopy[answer.reason]);
      } catch (error) {
        setMessage(
          error instanceof ApiError && error.code === "unauthorized"
            ? claimUnavailableCopy["signed-out"]
            : unreachableCopy,
        );
      }
    },
    [api, begin, feeSpeed, gameId, wallet],
  );

  const active = claims.find(({ id }) => id === activeId) ?? null;
  const signActive = useCallback(async () => {
    const transaction = active?.toSign ?? null;
    if (active === null || transaction === null) return;
    // The button is disabled without a signer, so there is nothing to say here; the review already says why.
    if (sign === undefined) return;
    setWorking(true);
    setMessage(null);
    try {
      let signed: ClaimTransaction | null;
      try {
        signed = await sign(transaction);
      } catch (error) {
        // The wallet was closed or declined, or what it answered could not be used: nothing was sent, and the claim can be signed again.
        console.error("Signing a claim failed.", error);
        return setMessage(walletRefusedCopy(error));
      }
      if (signed === null) return setMessage("Nothing was signed.");
      const answer = await api.submit({ claimId: active.id, signed });
      if (answer.status === "submitted") upsert(answer.claim, true);
      else setMessage(submitRefusal[answer.reason]);
    } catch {
      setMessage(unreachableCopy);
    } finally {
      setWorking(false);
    }
  }, [active, api, sign, upsert]);

  return {
    active,
    begin,
    // Why nothing can be signed, or null while something can.
    signerNote:
      sign !== undefined
        ? null
        : claimSignerCopy[
            wallet === null ? "not-connected" : "wallet-cannot-sign"
          ],
    claims,
    dismiss: useCallback(() => setActiveId(null), []),
    feeSpeed,
    setFeeSpeed,
    message,
    // Tells the player why a claim a game asked for could not start, in the page's own words (the game is given only a coarse reason).
    refuse: useCallback(
      (reason: GameClaimUnavailableReason) =>
        setMessage(claimUnavailableCopy[reason]),
      [],
    ),
    reopen: useCallback((claimId: string) => setActiveId(claimId), []),
    sign: signActive,
    start,
    // The newest claim for a milestone, if any.
    latestOf: (milestoneId: string): GameClaim | null =>
      [...claims]
        .reverse()
        .find((claim) => claim.milestoneId === milestoneId) ?? null,
    working,
  };
}
