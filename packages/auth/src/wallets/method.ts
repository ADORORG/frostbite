import type { DatabaseTransaction } from "@ador/database/connection";
import { walletIdentities } from "@ador/database/schema/auth";
import { eq } from "drizzle-orm";

import { shortenAddress } from "./short-address.ts";

import type { MethodAdapter } from "../methods/contracts.ts";

export const walletMethodKind = "wallet";

// A Bitcoin wallet: signs in, and is strong (a signature over a challenge bound to this site).
export const walletMethod: MethodAdapter<DatabaseTransaction> = {
  assurance: "strong",
  canSignIn: true,
  kind: walletMethodKind,
  list: async (transaction, userId) =>
    (
      await transaction
        .select({ id: walletIdentities.id })
        .from(walletIdentities)
        .where(eq(walletIdentities.userId, userId))
    ).map(({ id }) => id),
  // Named by the first wallet linked, shortened.
  label: async (transaction, userId) => {
    const [wallet] = await transaction
      .select({ address: walletIdentities.address })
      .from(walletIdentities)
      .where(eq(walletIdentities.userId, userId))
      .orderBy(walletIdentities.createdAt, walletIdentities.id)
      .limit(1);
    return wallet === undefined ? null : shortenAddress(wallet.address);
  },
  // A wallet is found by its address, written as stored.
  lookup: async (transaction, text) =>
    (
      await transaction
        .select({ userId: walletIdentities.userId })
        .from(walletIdentities)
        .where(eq(walletIdentities.address, text.trim()))
    ).map(({ userId }) => userId),
};
