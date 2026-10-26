import { EmailSignIn } from "./email-sign-in.tsx";
import { PasskeySignIn } from "./passkey-sign-in.tsx";
import type { SignInView } from "./views.ts";
import { WalletSignIn } from "./wallet-sign-in.tsx";

// The ways this deployment's sign-in page knows how to show. To add a method, add its view here and register its adapter on the
// server (`features/accounts/src/runtime.ts`); email, and later phone, joined the same way.
export const signInViews: readonly SignInView[] = [
  {
    Component: WalletSignIn,
    glyph: "◈",
    kind: "wallet",
    label: "Wallet",
    tagline: "Sign a message",
  },
  {
    Component: PasskeySignIn,
    glyph: "⌁",
    kind: "passkey",
    label: "Passkey",
    tagline: "Use this device",
  },
  {
    Component: EmailSignIn,
    glyph: "✉",
    kind: "email",
    label: "Email",
    tagline: "Get a one-time code",
  },
];
