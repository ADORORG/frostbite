"use client";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useState, type FormEvent } from "react";

import { requestEmailCode, verifyEmailCode } from "./email-sign-in-flow.ts";
import type { SignInViewProps } from "./views.ts";

// Signing in with a code sent by email: ask for it, then enter it. "A code was sent" is shown only after the server has said so, and the
// page never says whether the address already has an account.
export function EmailSignIn({ onSignedIn }: SignInViewProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"address" | "code" | "signed-in">("address");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const request = createRequester(sameOriginFetch);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    setWorking(true);
    const outcome = await requestEmailCode(request, email);
    setWorking(false);
    if (outcome.kind === "sent") {
      setStep("code");
      setCode("");
      setNotice(null);
    } else {
      setNotice(outcome.message);
    }
  }

  async function enter(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    const outcome = await verifyEmailCode(request, email, code);
    setWorking(false);
    if (outcome.kind === "signed-in") {
      setStep("signed-in");
      onSignedIn();
    } else {
      setNotice(outcome.message);
    }
  }

  if (step === "signed-in")
    return <p role="status">Signed in. Taking you back…</p>;
  return step === "address" ? (
    <form
      className="arcade-form sign-in-method"
      onSubmit={(event) => void ask(event)}
    >
      <p>We will email you a code. It works once and expires in minutes.</p>
      <ArcadeTextField
        autoComplete="email"
        inputMode="email"
        label="Email address"
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
      {notice === null ? null : <p role="alert">{notice}</p>}
    </form>
  ) : (
    <form
      className="arcade-form sign-in-method"
      onSubmit={(event) => void enter(event)}
    >
      <p role="status">
        If that address can receive mail, a code is on its way to{" "}
        <strong>{email.trim().toLowerCase()}</strong>.
      </p>
      <ArcadeTextField
        autoComplete="one-time-code"
        inputMode="numeric"
        label="Code"
        onChange={setCode}
        required
        value={code}
      />
      <div className="arcade-actions">
        <ArcadeActionButton busy={working} type="submit">
          Sign in
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
            setNotice(null);
          }}
          tone="pink"
        >
          Use a different address
        </ArcadeActionButton>
      </div>
      {notice === null ? null : <p role="alert">{notice}</p>}
    </form>
  );
}
