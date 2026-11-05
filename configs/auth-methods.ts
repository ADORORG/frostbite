import { createAuthMethods } from "@frostbite/feature-accounts";

import { mailSettings } from "./mail.ts";

// The sign-in methods this deployment offers (ADR-021). Email is one of them only where mail is set up.
export const authMethods = createAuthMethods({ email: mailSettings !== null });
