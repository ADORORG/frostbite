// Wallet extensions reject with either Error instances or JSON-RPC objects. Unknown is confined
// to this vendor boundary and narrowed before returning curated, concrete user-facing copy.
export interface WalletConnectionFailure {
  readonly kind:
    | "account-setup-required"
    | "provider-unavailable"
    | "cancelled"
    | "integration-failure";
  readonly message: string;
}

export function classifyWalletConnectionError(
  error: unknown,
): WalletConnectionFailure {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("not initialized") ||
    normalized.includes("at least one account") ||
    normalized.includes("no accounts")
  ) {
    return {
      kind: "account-setup-required",
      message:
        "Wallet account setup required. Open the extension, unlock it, and create or import an account, then retry.",
    };
  }
  if (
    normalized.includes("not installed") ||
    normalized.includes("isn't installed") ||
    normalized.includes("no orange bitcoin wallet installed") ||
    normalized.includes("wallet not found")
  ) {
    return {
      kind: "provider-unavailable",
      message:
        "Wallet not found in this browser. Install it if needed, or enable its Bitcoin provider for this site, then retry.",
    };
  }
  if (normalized.includes("reject") || normalized.includes("cancel")) {
    return {
      kind: "cancelled",
      message:
        "The connection request was cancelled. Select the wallet to try again.",
    };
  }
  return {
    kind: "integration-failure",
    message:
      "Wallet connection failed. The wallet integration could not complete the request. Retry; if this persists, try another wallet.",
  };
}
