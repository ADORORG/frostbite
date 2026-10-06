"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WalletConnectionClient } from "@ador/wallet/client";
import {
  qualificationChallengeSchema,
  qualificationResultSchema,
  qualificationRoutes,
} from "@ador/shared/wallet-qualification";

export function WalletQualificationPanel({
  wallet,
}: {
  readonly wallet: WalletConnectionClient;
}) {
  const activeWallet = useRef(wallet);
  useLayoutEffect(() => {
    activeWallet.current = wallet;
  }, [wallet]);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [status, setStatus] = useState(
    "Ready to test message signing. This is not sign-in.",
  );
  const [pending, setPending] = useState(false);
  async function qualify() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const selected = wallet;
    const unchanged = () =>
      mounted.current &&
      activeWallet.current.connected &&
      activeWallet.current.address === selected.address &&
      activeWallet.current.network === selected.network &&
      activeWallet.current.provider === selected.provider;
    try {
      setStatus("Requesting a qualification challenge…");
      const response = await fetch(qualificationRoutes.begin.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: selected.address,
          provider: selected.provider,
          network: selected.network,
        }),
      });
      if (!response.ok) throw new Error("Challenge unavailable");
      // The HTTP response is untrusted and immediately parsed to a concrete wire contract.
      const challenge = qualificationChallengeSchema.parse(
        await response.json(),
      );
      if (!unchanged()) throw new Error("Wallet changed");
      setStatus(
        "Approve or reject the qualification message in your wallet. No transaction is requested.",
      );
      const signature = await selected.signMessage(challenge.message);
      if (!unchanged()) throw new Error("Wallet changed");
      setStatus("Verifying the signature on the server…");
      const verified = await fetch(qualificationRoutes.verify.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          message: challenge.message,
          signature,
        }),
      });
      if (!verified.ok) throw new Error("Verification failed");
      qualificationResultSchema.parse(await verified.json());
      if (!unchanged()) throw new Error("Wallet changed");
      setStatus(
        "Signature verified by the server. No session created. Wallet support is still pending qualification.",
      );
    } catch {
      if (mounted.current)
        setStatus(
          "The test did not complete. If you rejected the request, that is expected. Check your wallet account and network, then retry with a fresh challenge.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <section aria-label="Message signing qualification">
      <p role="status">{status}</p>
      <button
        className="arcade-button arcade-button--cyan"
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => void qualify()}
      >
        {pending ? "Testing message signature…" : "Test message signing"}
      </button>
    </section>
  );
}
