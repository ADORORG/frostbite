import {
  createMethodRegistry,
  type MethodRegistry,
  passkeyMethod,
  walletMethod,
} from "@ador/auth";
import type { DatabaseTransaction } from "@ador/database/connection";
import type { MethodKind } from "@ador/shared/accounts";

// The sign-in methods this deployment offers, composed once and used everywhere: the sign-in and account pages, removing a method
// under the "keep one way in" rule, and deciding whether a platform role works (staff and admin need a wallet). A new method (email,
// phone) is one adapter added to this list, with its own routes: nothing that reads the registry is edited (ADR-021).
export const authMethods = createMethodRegistry<DatabaseTransaction>([
  walletMethod,
  passkeyMethod,
]);

// The kinds of method an account holds, as authorization asks for them.
export function createHeldMethodKinds<Context>(
  methods: Pick<MethodRegistry<Context>, "list">,
) {
  return async (
    context: Context,
    userId: string,
  ): Promise<ReadonlySet<MethodKind>> =>
    new Set((await methods.list(context, userId)).map(({ kind }) => kind));
}
