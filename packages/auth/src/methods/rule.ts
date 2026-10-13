// What an account can sign in with, and what it merely has. A wallet signs in; a passkey is added to an account
// and cannot start a session by itself (it is link-only today); an email will sign in when that adapter exists.
// The rule below is the one place that decides whether a method may be removed, so wallets and passkeys cannot
// disagree about it.
export type AccountMethodKind = "email" | "passkey" | "wallet";

export interface AccountMethod {
  // Whether this method can start a session. Removing the last one that can would lock the account out.
  readonly canSignIn: boolean;
  // The method's own identifier: the wallet identity's id, the passkey's credential id.
  readonly id: string;
  readonly kind: AccountMethodKind;
}

export type RemovalOutcome = "final-method" | "missing" | "ok";

// May this method be removed from the account? `missing` when the account has no such method; `final-method` when
// removing it would leave nothing that can sign in. Everything else is allowed, including removing the last of a
// method that cannot sign in (a passkey), because the account still has a way in.
export function removalOutcome(
  methods: readonly AccountMethod[],
  removing: { readonly id: string; readonly kind: AccountMethodKind },
): RemovalOutcome {
  const target = methods.find(
    ({ id, kind }) => id === removing.id && kind === removing.kind,
  );
  if (target === undefined) return "missing";
  const remaining = methods.filter((method) => method !== target);
  return remaining.some(({ canSignIn }) => canSignIn) ? "ok" : "final-method";
}
