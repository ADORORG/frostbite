import type { HttpErrorCode } from "../http/index.ts";

// Everything that can go wrong when a person signs in, links a way in, administers roles, or opens the first-administrator link, and what is said about it. This is the one
// catalogue: the server builds each failure from it (the reason travels in the error envelope), and the page chooses its words from the
// reason, never from the message. A sentence is written here once; a test fails if two reasons say the same thing or a reason has no
// words, and `tooling/repository-policy` fails if a sentence like these is written anywhere else.
//
// `http` is the status class the server answers with, or null for what only ever happens in the browser (no connection, a prompt closed).
// `serverWords` marks the few where the server knows more than the catalogue (how long to wait, which sign-in methods are missing), so the page shows the server's sentence
// when it sent one and this one otherwise.
interface Outcome {
  readonly http: HttpErrorCode | null;
  readonly message: string;
  readonly serverWords?: true;
}

export const accountOutcomes = {
  // The ways any request can fail.
  network: {
    http: null,
    message: "The request could not reach the server. Try again.",
  },
  "rate-limited": {
    http: "rate_limited",
    message: "Too many requests. Wait a minute and try again.",
  },
  "signed-out": {
    http: "unauthorized",
    message: "You are signed out. Sign in again to continue.",
  },
  "recent-authentication-required": {
    http: "forbidden",
    message: "For safety, sign in again before making this change, then retry.",
  },
  "last-sign-in-method": {
    http: "conflict",
    message: "This is your only way to sign in. Add another one first.",
  },
  // Email.
  "invalid-email": {
    http: "invalid_request",
    message: "Enter a valid email address.",
  },
  "email-unavailable": {
    http: "not_found",
    message: "Signing in by email is not available right now.",
  },
  "code-not-sent": {
    http: "conflict",
    message: "The code could not be sent. Try again in a moment.",
  },
  "code-too-soon": {
    http: "conflict",
    message: "A code was sent recently. Try again in a moment.",
    serverWords: true,
  },
  "code-wrong": {
    http: "unauthorized",
    message:
      "That code is not right, or it has expired. Check it, or ask for a new one.",
  },
  "email-taken": {
    http: "conflict",
    message:
      "This email address is already linked to a different account. Sign in to that account and remove it there first, or use another address.",
  },
  "email-limit-reached": {
    http: "conflict",
    message:
      "This account already has as many email addresses as it can hold. Remove one before adding another.",
  },
  "email-missing": {
    http: "not_found",
    message: "That address is not on this account any more.",
  },
  // Wallets.
  "wallet-not-verified": {
    http: "unauthorized",
    message:
      "The wallet could not be verified. Try again with a fresh signature.",
  },
  "wallet-request-invalid": {
    http: "invalid_request",
    message: "The wallet request is not valid.",
  },
  "wallet-unusable": {
    http: "conflict",
    message: "This wallet cannot be used for that.",
  },
  "wallet-on-another-account": {
    http: "conflict",
    message:
      "This wallet is already linked to a different account. Sign in to that account and remove it there first, or use another wallet.",
  },
  "wallet-held": {
    http: "conflict",
    message:
      "This wallet was recently removed from an account and is held for a while, so it cannot be used with another account yet. Try again later.",
  },
  "wallet-not-on-account": {
    http: "conflict",
    message:
      "This wallet is not linked to your account, so it cannot confirm this change. Use one of your linked wallets.",
  },
  "wallet-missing": {
    http: "not_found",
    message: "That wallet is not on this account any more.",
  },
  "wallet-not-connected": { http: null, message: "Connect a wallet first." },
  "wallet-refused": {
    http: null,
    message: "The wallet did not sign. Nothing was changed.",
  },
  "wallet-changed": {
    http: null,
    message: "The wallet changed while you were signing. Nothing was changed.",
  },
  // Passkeys.
  "passkey-not-verified": {
    http: "unauthorized",
    message: "That passkey could not be verified. Try again.",
  },
  "passkey-change-failed": {
    http: "conflict",
    message:
      "The passkey change could not be completed. Refresh before trying again.",
  },
  "passkey-cancelled": {
    http: null,
    message: "No passkey was used. You can try again.",
  },
  "passkey-unsupported": {
    http: null,
    message: "This browser cannot use passkeys.",
  },
  // Roles.
  "not-an-administrator": {
    http: "forbidden",
    message: "Only an administrator whose role is working can change roles.",
  },
  "not-a-role": {
    http: "invalid_request",
    message: "That is not a platform role.",
  },
  "no-such-account": { http: "not_found", message: "No such account." },
  "last-administrator": {
    http: "conflict",
    message:
      "This is the last working administrator. Make another administrator first.",
  },
  // The single-use link that makes the first administrator.
  "setup-link-invalid": {
    http: "not_found",
    message:
      "This setup link is not valid, or it has expired. Ask for a new one.",
  },
  "setup-method-needed": {
    http: "conflict",
    message:
      "This account needs another way to sign in first. Add it, then open the link again.",
    serverWords: true,
  },
} as const satisfies Record<string, Outcome>;

export type AccountOutcome = keyof typeof accountOutcomes;

const known: ReadonlySet<string> = new Set(Object.keys(accountOutcomes));
// A reason a server sent, if it is one of these: the page never trusts a string it was not built with.
export function isAccountOutcome(
  reason: string | null,
): reason is AccountOutcome {
  return reason !== null && known.has(reason);
}

// The words for an outcome, preferring the server's own where the catalogue says it knows more.
export function outcomeMessage(
  outcome: AccountOutcome,
  serverMessage: string | null = null,
): string {
  const entry: Outcome = accountOutcomes[outcome];
  return entry.serverWords === true && serverMessage !== null
    ? serverMessage
    : entry.message;
}
