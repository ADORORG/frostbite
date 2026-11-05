import type { DatabaseTransaction } from "@frostbite/database/connection";
import { contactIdentities } from "@frostbite/database/schema/contact-sign-in";
import { and, eq } from "drizzle-orm";

import type {
  AssuranceLevel,
  MethodAdapter,
  MethodKind,
} from "../methods/contracts.ts";
import { emailMethodKind, normalizeEmailAddress } from "./email-channel.ts";

// A method held as a contact identity (an address or a number the person has proved they control). One factory for all of them: a new
// channel is one more call with its kind, assurance and normalizer.
export function createContactMethod(options: {
  readonly assurance: AssuranceLevel;
  readonly kind: MethodKind;
  // The channel's own way of writing a destination, so a lookup finds "Ada@Example.com " as "ada@example.com"; null when it cannot be one.
  readonly normalize: (raw: string) => string | null;
}): MethodAdapter<DatabaseTransaction> {
  const { assurance, kind, normalize } = options;
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
    // Named by the oldest address the account holds.
    label: async (transaction, userId) => {
      const [first] = await transaction
        .select({ value: contactIdentities.value })
        .from(contactIdentities)
        .where(
          and(
            eq(contactIdentities.userId, userId),
            eq(contactIdentities.kind, kind),
          ),
        )
        .orderBy(contactIdentities.createdAt, contactIdentities.value)
        .limit(1);
      return first?.value ?? null;
    },
    lookup: async (transaction, text) => {
      const value = normalize(text);
      if (value === null) return [];
      return (
        await transaction
          .select({ userId: contactIdentities.userId })
          .from(contactIdentities)
          .where(
            and(
              eq(contactIdentities.kind, kind),
              eq(contactIdentities.value, value),
            ),
          )
      ).map(({ userId }) => userId);
    },
  };
}

// An email address: standard assurance (anyone who controls the mailbox controls the account; weaker than a wallet or a passkey).
export const emailMethod = createContactMethod({
  assurance: "standard",
  kind: emailMethodKind,
  normalize: normalizeEmailAddress,
});
