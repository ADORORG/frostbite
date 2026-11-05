"use client";

import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { createRequester, sameOriginFetch } from "@frostbite/client-http";
import { useState } from "react";
import {
  ArcadeActionButton,
  ConsoleCard,
  ConsoleRow,
  StatusLamp,
} from "@repo/ui/arcade";

import {
  linkPasskey,
  removePasskey,
  type PasskeyChange,
} from "./passkey-link-flow.ts";

type Status = "idle" | "working" | "success" | "error";

export function PasskeyPanel({
  initialCredentialIds,
  initialUnavailable,
}: {
  readonly initialCredentialIds: readonly string[];
  readonly initialUnavailable: boolean;
}) {
  const [credentialIds, setCredentialIds] = useState(initialCredentialIds);
  const [status, setStatus] = useState<Status>(
    initialUnavailable ? "error" : "idle",
  );
  const [message, setMessage] = useState(
    initialUnavailable
      ? "Passkey status is unavailable. No linked state is assumed."
      : "Linked passkeys are off-chain account methods only. Wallet and on-chain authority remain separate.",
  );
  const request = createRequester(sameOriginFetch);

  // Shows what a change did. The list and the "done" words come only from a change the server accepted and the list confirmed.
  function show(result: PasskeyChange, done: string) {
    if (result.kind === "failed") {
      setStatus("error");
      setMessage(result.message);
      return;
    }
    setCredentialIds(result.credentialIds);
    setStatus("success");
    setMessage(done);
  }

  async function link() {
    setStatus("working");
    show(
      await linkPasskey({
        ask: (options) => startRegistration({ optionsJSON: options }),
        request,
        supported: browserSupportsWebAuthn,
      }),
      "Passkey linked. Other sessions were revoked for safety.",
    );
  }

  async function unlink(credentialId: string) {
    setStatus("working");
    show(
      await removePasskey(request, credentialId),
      "Passkey removed. Other sessions were revoked for safety.",
    );
  }

  return (
    <ConsoleCard
      count={credentialIds.length}
      glyph="⌁"
      lead="Keys saved on a device or a security key. They sign you in and confirm changes; nothing is sent on chain."
      title="Passkeys"
    >
      <StatusLamp
        label={message}
        tone={
          status === "success"
            ? "ready"
            : status === "error"
              ? "unavailable"
              : "attention"
        }
      />
      {credentialIds.length === 0 ? (
        <p>No passkey is linked to this account yet.</p>
      ) : (
        <ul aria-label="Linked passkeys" className="console-list">
          {credentialIds.map((credentialId, index) => (
            <ConsoleRow
              action={
                <ArcadeActionButton
                  ariaLabel={`Remove passkey ${String(index + 1)}`}
                  disabled={status === "working"}
                  onClick={() => void unlink(credentialId)}
                  size="small"
                  tone="yellow"
                >
                  Remove
                </ArcadeActionButton>
              }
              key={credentialId}
              leading={<span aria-hidden="true">⌁</span>}
              name={`Passkey ${String(index + 1)}`}
            />
          ))}
        </ul>
      )}
      <div className="arcade-actions">
        <ArcadeActionButton
          busy={status === "working"}
          onClick={() => void link()}
        >
          Add passkey
        </ArcadeActionButton>
      </div>
    </ConsoleCard>
  );
}
