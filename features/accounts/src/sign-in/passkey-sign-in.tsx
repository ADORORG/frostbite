"use client";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useState } from "react";

import { type Failed } from "../client/outcome.ts";
import { signInWithPasskey } from "./passkey-sign-in-flow.ts";
import type { SignInViewProps } from "./views.ts";

// Signing in with a passkey. "Signed in" is shown only after the server has said so, and the page moves on once.
export function PasskeySignIn({ onSignedIn }: SignInViewProps) {
  const [state, setState] = useState<"idle" | "signed-in" | "working" | Failed>(
    "idle",
  );
  async function signIn() {
    setState("working");
    const result = await signInWithPasskey({
      ask: (options) => startAuthentication({ optionsJSON: options }),
      request: createRequester(sameOriginFetch),
      supported: browserSupportsWebAuthn,
    });
    setState(result.kind === "signed-in" ? "signed-in" : result);
    if (result.kind === "signed-in") onSignedIn();
  }
  return (
    <div className="sign-in-method">
      <p>
        Use a passkey saved on this device or a security key. Nothing is sent on
        chain.
      </p>
      <button
        disabled={state === "working" || state === "signed-in"}
        onClick={() => void signIn()}
        type="button"
      >
        {state === "working"
          ? "Waiting for your passkey…"
          : "Sign in with passkey"}
      </button>
      {state === "signed-in" ? (
        <p role="status">Signed in. Taking you back…</p>
      ) : typeof state === "string" ? null : (
        <p role="alert">{state.message}</p>
      )}
    </div>
  );
}
