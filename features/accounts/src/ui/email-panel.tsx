"use client";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import {
  ArcadeActionButton,
  ConsoleCard,
  ConsoleRow,
  ArcadeTextField,
  StatusLamp,
} from "@repo/ui/arcade";
import { useState, type FormEvent } from "react";

import {
  confirmLinkCode,
  listEmailAddresses,
  removeEmailAddress,
  requestLinkCode,
} from "./email-link-flow.ts";

type Tone = "attention" | "ready" | "unavailable";

// The email addresses that sign in to this account: add one by proving the mailbox with a code, remove one while another way in
// remains. A change signs the other sessions out, and the page says so only after the server did it.
export function EmailPanel({
  initialAddresses,
}: {
  readonly initialAddresses: readonly string[];
}) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [step, setStep] = useState<"address" | "code">("address");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ tone: Tone; text: string }>({
    text: "Email addresses can sign in to this account. Adding or removing one signs your other sessions out.",
    tone: "attention",
  });
  const request = createRequester(sameOriginFetch);

  // Reads the list again after a change. False when it could not be read: the change was made, but the list shown may be out of date.
  async function refresh(): Promise<boolean> {
    try {
      setAddresses(await listEmailAddresses(request));
      return true;
    } catch {
      return false;
    }
  }

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    setWorking(true);
    const outcome = await requestLinkCode(request, email);
    setWorking(false);
    if (outcome.kind === "sent") {
      setStep("code");
      setCode("");
      setMessage({
        text: "If that address can receive mail, a code is on its way.",
        tone: "attention",
      });
    } else setMessage({ text: outcome.message, tone: "unavailable" });
  }

  async function enter(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    const outcome = await confirmLinkCode(request, email, code);
    if (outcome.kind === "linked") {
      const listed = await refresh();
      setStep("address");
      setEmail("");
      setCode("");
      setMessage({
        text: listed
          ? "Address added. Your other sessions were signed out for safety."
          : "Address added, and your other sessions were signed out, but the list could not be refreshed. Reload the page.",
        tone: listed ? "ready" : "attention",
      });
    } else setMessage({ text: outcome.message, tone: "unavailable" });
    setWorking(false);
  }

  async function remove(address: string) {
    setWorking(true);
    const outcome = await removeEmailAddress(request, address);
    if (outcome.kind === "removed") {
      const listed = await refresh();
      setMessage({
        text: listed
          ? "Address removed. Your other sessions were signed out for safety."
          : "Address removed, and your other sessions were signed out, but the list could not be refreshed. Reload the page.",
        tone: listed ? "ready" : "attention",
      });
    } else setMessage({ text: outcome.message, tone: "unavailable" });
    setWorking(false);
  }

  return (
    <ConsoleCard
      count={addresses.length}
      glyph="✉"
      lead="Addresses that can sign in to this account with a one-time code."
      title="Email addresses"
    >
      <StatusLamp label={message.text} tone={message.tone} />
      {addresses.length === 0 ? (
        <p>No email address is linked to this account.</p>
      ) : (
        <ul aria-label="Linked email addresses" className="console-list">
          {addresses.map((address) => (
            <ConsoleRow
              action={
                <ArcadeActionButton
                  ariaLabel={`Remove ${address}`}
                  disabled={working}
                  onClick={() => void remove(address)}
                  size="small"
                  tone="yellow"
                >
                  Remove
                </ArcadeActionButton>
              }
              key={address}
              leading={<span aria-hidden="true">✉</span>}
              name={address}
            />
          ))}
        </ul>
      )}
      {step === "address" ? (
        <form className="arcade-form" onSubmit={(event) => void ask(event)}>
          <ArcadeTextField
            autoComplete="email"
            inputMode="email"
            label="Add an email address"
            onChange={setEmail}
            required
            type="email"
            value={email}
          />
          <div className="arcade-actions">
            <ArcadeActionButton busy={working} type="submit">
              Email me a code
            </ArcadeActionButton>
          </div>
        </form>
      ) : (
        <form className="arcade-form" onSubmit={(event) => void enter(event)}>
          <ArcadeTextField
            autoComplete="one-time-code"
            inputMode="numeric"
            label={`Code sent to ${email.trim().toLowerCase()}`}
            onChange={setCode}
            required
            value={code}
          />
          <div className="arcade-actions">
            <ArcadeActionButton busy={working} type="submit">
              Add address
            </ArcadeActionButton>
            <ArcadeActionButton
              disabled={working}
              onClick={() => void ask()}
              tone="mint"
            >
              Send a new code
            </ArcadeActionButton>
            <ArcadeActionButton
              disabled={working}
              onClick={() => {
                setStep("address");
                setMessage({
                  text: "Email addresses can sign in to this account.",
                  tone: "attention",
                });
              }}
              tone="pink"
            >
              Use a different address
            </ArcadeActionButton>
          </div>
        </form>
      )}
    </ConsoleCard>
  );
}
