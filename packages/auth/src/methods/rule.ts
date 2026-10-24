import {
  assuranceRank,
  type AssuranceLevel,
  type LinkedMethod,
  type MethodKind,
} from "./contracts.ts";

// The rules about an account's methods. They are pure, take the methods the account has, and know no kind by name, so adding a method
// changes none of them. The repositories use them under the account's lock; policy uses them to decide who may hold a role.

export type RemovalOutcome = "final-method" | "missing" | "ok";

// May this method be removed from the account? `missing` when the account has no such method (the same answer when a request is
// repeated); `final-method` when removing it would leave nothing that can sign in. Everything else is allowed, including removing the
// last of a method that cannot sign in, because the account still has a way in.
export function removalOutcome(
  methods: readonly LinkedMethod[],
  removing: { readonly id: string; readonly kind: MethodKind },
): RemovalOutcome {
  const target = methods.find(
    ({ id, kind }) => id === removing.id && kind === removing.kind,
  );
  if (target === undefined) return "missing";
  const remaining = methods.filter((method) => method !== target);
  return remaining.some(({ canSignIn }) => canSignIn) ? "ok" : "final-method";
}

// Does the account hold a method of this kind? (Staff and admin need a wallet.)
export function holdsMethod(
  methods: readonly LinkedMethod[],
  kind: MethodKind,
): boolean {
  return methods.some((method) => method.kind === kind);
}

// Does the account hold a method at or above this assurance level? Holding is enough; whether it was used to sign in just now is the
// session's business.
export function meetsAssurance(
  methods: readonly LinkedMethod[],
  required: AssuranceLevel,
): boolean {
  return methods.some(
    ({ assurance }) => assuranceRank(assurance) >= assuranceRank(required),
  );
}
