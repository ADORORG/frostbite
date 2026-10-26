"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import {
  passkeyBeginResponseSchema,
  passkeyListResponseSchema,
  passkeyMutationResponseSchema,
} from "@ador/auth";
import {
  ArcadeActionButton,
  SectionBlock,
  ListRow,
  StatusLamp,
} from "@repo/ui/arcade";

type Status = "idle" | "working" | "success" | "error";

async function jsonRequest(
  path: string,
  method: "GET" | "POST",
  body?: object,
) {
  const response = await fetch(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    method,
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error("Passkey request failed");
  return payload;
}

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

  async function refresh() {
    const payload = await jsonRequest("/api/v1/passkeys", "GET");
    setCredentialIds(passkeyListResponseSchema.parse(payload).credentialIds);
  }

  async function link() {
    setStatus("working");
    try {
      const begin = passkeyBeginResponseSchema.parse(
        await jsonRequest("/api/v1/passkeys/registration/options", "POST", {}),
      );
      const credential = await startRegistration({
        optionsJSON: begin.options,
      });
      passkeyMutationResponseSchema.parse(
        await jsonRequest("/api/v1/passkeys/registration/verify", "POST", {
          challengeId: begin.challengeId,
          credential,
        }),
      );
      await refresh();
      setStatus("success");
      setMessage("Passkey linked. Other sessions were revoked for safety.");
    } catch {
      setStatus("error");
      setMessage(
        "Passkey linking could not be confirmed. Refresh before trying again.",
      );
    }
  }

  async function unlink(credentialId: string) {
    setStatus("working");
    try {
      passkeyMutationResponseSchema.parse(
        await jsonRequest("/api/v1/passkeys/unlink", "POST", { credentialId }),
      );
      await refresh();
      setStatus("success");
      setMessage("Passkey removed. Other sessions were revoked for safety.");
    } catch {
      setStatus("error");
      setMessage(
        "Passkey removal could not be confirmed. Refresh before trying again.",
      );
    }
  }

  return (
    <SectionBlock
      description="Keys saved on a device or a security key. They sign you in and confirm changes; nothing is sent on chain."
      title="Passkeys"
    >
      <StatusLamp
        plain
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
        <ul aria-label="Linked passkeys" className="list-rows">
          {credentialIds.map((credentialId, index) => (
            <ListRow
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
    </SectionBlock>
  );
}
