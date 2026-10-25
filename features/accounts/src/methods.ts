import {
  createMethodRegistry,
  emailMethod,
  passkeyMethod,
  walletMethod,
} from "@ador/auth";
import type { DatabaseTransaction } from "@ador/database/connection";

// The sign-in methods a deployment offers, composed once at the platform's configuration and used everywhere: the sign-in and account
// pages, removing a method under the "keep one way in" rule, and deciding whether a platform role works (staff and admin need a
// wallet). A new method (phone) is one adapter added here, with its own routes: nothing that reads the registry is edited (ADR-021).
// Email is offered only where mail is set up, so a deployment without it never shows a sign-in that cannot send its code.
export function createAuthMethods(options: { readonly email: boolean }) {
  return createMethodRegistry<DatabaseTransaction>([
    walletMethod,
    passkeyMethod,
    ...(options.email ? [emailMethod] : []),
  ]);
}

export { createHeldMethodKinds } from "./held-method-kinds.ts";
