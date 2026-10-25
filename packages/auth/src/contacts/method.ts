import type { DatabaseTransaction } from "@ador/database/connection";
import { contactIdentities } from "@ador/database/schema/contact-sign-in";
import { and, eq } from "drizzle-orm";

import type {
  AssuranceLevel,
  MethodAdapter,
  MethodKind,
} from "../methods/contracts.ts";
import { emailMethodKind } from "./email-channel.ts";

// A method held as a contact identity (an address or a number the person has proved they control). One factory for all of them: a new
// channel is one more call with its kind and assurance.
export function createContactMethod(
  kind: MethodKind,
  assurance: AssuranceLevel,
): MethodAdapter<DatabaseTransaction> {
  return {
    assurance,
    canSignIn: true,
    kind,
    list: async (transaction, userId) =>
      (
        await transaction
          .select({ id: contactIdentities.value })
          .from(contactIdentities)
          .where(
            and(
              eq(contactIdentities.userId, userId),
              eq(contactIdentities.kind, kind),
            ),
          )
      ).map(({ id }) => id),
  };
}

// An email address: standard assurance (anyone who controls the mailbox controls the account; weaker than a wallet or a passkey).
export const emailMethod = createContactMethod(emailMethodKind, "standard");
