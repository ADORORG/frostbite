import { ApiError } from "@ador/client-http";
import { outcomeMessage } from "@ador/shared/account-outcomes";

import type { RedeemSetupLinkResponse } from "./contract.ts";

// Where the token waits while the person signs in. It is kept for the length of the visit and nowhere else.
export interface TokenStore {
  clear(): void;
  read(): string | null;
  write(token: string): void;
}

// What the page can truthfully say. `done` only after the server said the person is an administrator.
export type SetupState =
  | { readonly kind: "checking" }
  | { readonly kind: "no-link" }
  | { readonly kind: "sign-in" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "needs-method"; readonly message: string }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "done" };

// The token in the address after the `#`. Only the shape of a token is accepted; anything else is as good as no link.
const tokenInAddress = /^#([A-Za-z0-9_-]{1,256})$/u;

export function tokenFromAddress(hash: string): string | null {
  return tokenInAddress.exec(hash)?.[1] ?? null;
}

// Opens the link for the signed-in person (or finds out they are not signed in), and decides what happens to the saved token: it is
// dropped once the link can never work again (used, or not valid) and kept while the person can still fix things and try again.
export async function redeemSavedToken(input: {
  readonly redeem: (token: string) => Promise<RedeemSetupLinkResponse>;
  readonly store: TokenStore;
}): Promise<SetupState> {
  const token = input.store.read();
  if (token === null) return { kind: "no-link" };
  try {
    await input.redeem(token);
    input.store.clear();
    return { kind: "done" };
  } catch (error) {
    if (!(error instanceof ApiError))
      return { kind: "failed", message: "Something went wrong." };
    if (error.code === "unauthorized") return { kind: "sign-in" };
    if (error.code === "not_found") {
      input.store.clear();
      return {
        kind: "invalid",
        message: outcomeMessage("setup-link-invalid"),
      };
    }
    if (error.code === "conflict")
      return {
        kind: "needs-method",
        message: outcomeMessage("setup-method-needed", error.message),
      };
    return { kind: "failed", message: error.message };
  }
}
