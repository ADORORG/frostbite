import type { SignInView } from "./views.ts";
import { WalletSignIn } from "./wallet-sign-in.tsx";

// The ways this deployment's sign-in page knows how to show. To add a method, add its view here and register its adapter on the
// server (`features/accounts/src/runtime.ts`); passkey and email join the same way.
export const signInViews: readonly SignInView[] = [
  { Component: WalletSignIn, kind: "wallet", label: "Wallet" },
];
