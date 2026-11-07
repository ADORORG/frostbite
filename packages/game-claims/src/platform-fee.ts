import { InvalidAddressError } from "@frostbite/chain/ports";
import type { DatabaseClient } from "@frostbite/database/connection";
import { platformFeeSettings } from "@frostbite/database/schema/platform-fee";
import type { ChainRef } from "@frostbite/shared/chain";
import { desc, eq, sql } from "drizzle-orm";

import type { ClaimChainPorts, PlatformFeeSetting } from "./types.ts";

// The platform's fee on milestone claims, as staff set it for a chain. Every setting is a row that is only ever added, so the fee in
// force is the newest row and the rows are the history: who set what, and when.
export interface PlatformFeeChange {
  readonly changedAt: Date;
  // Who set it; none when that account is gone.
  readonly changedBy: string | null;
  readonly chain: ChainRef;
  readonly feeSats: bigint;
  readonly id: string;
  readonly treasury: string;
}

export type SetPlatformFeeResult =
  | { readonly change: PlatformFeeChange; readonly ok: true }
  | {
      readonly code:
        | "above-maximum"
        | "below-minimum-output"
        | "chain-unavailable"
        | "invalid-address";
      // The limit that was crossed, in the chain's smallest unit, for the two codes that have one.
      readonly limit?: bigint;
      readonly ok: false;
    };

export interface PlatformFeeDependencies {
  readonly clock: () => Date;
  readonly database: DatabaseClient;
  // The most a fee may be set to: a guard against a slip of the keyboard, set by policy.
  readonly maximumFeeSats: bigint;
  readonly newId: () => string;
  // The chain's address rules, or none for a chain the platform does not serve.
  ports(chain: ChainRef): Pick<ClaimChainPorts, "addressCodec"> | null;
}

type Row = typeof platformFeeSettings.$inferSelect;

const toChange = (row: Row): PlatformFeeChange => ({
  chain: row.chain as ChainRef,
  changedAt: row.createdAt,
  changedBy: row.changedBy,
  feeSats: row.feeSats,
  id: row.id,
  treasury: row.treasuryAddress,
});

// What a claim needs of the fee: what it charges on a chain now, read by the index (one entry, however many settings there are). None
// when no fee was ever set or it was set to zero.
export function createPlatformFeeReader(database: DatabaseClient) {
  async function newest(chain: ChainRef): Promise<PlatformFeeChange | null> {
    const [row] = await database
      .select()
      .from(platformFeeSettings)
      .where(eq(platformFeeSettings.chain, chain))
      .orderBy(sql`${platformFeeSettings.createdAt} desc nulls last`)
      .limit(1);
    return row === undefined ? null : toChange(row);
  }
  return {
    async setting(chain: ChainRef): Promise<PlatformFeeSetting | null> {
      const current = await newest(chain);
      return current === null || current.feeSats === 0n
        ? null
        : { feeSats: current.feeSats, treasury: current.treasury };
    },
  };
}

export function createPlatformFeeService(
  dependencies: PlatformFeeDependencies,
) {
  const { clock, database, maximumFeeSats, newId, ports } = dependencies;
  const reader = createPlatformFeeReader(database);

  return {
    // What a claim charges on the chain now: none when no fee was ever set or it was set to zero.
    setting: reader.setting,

    // What staff see: the fee in force (even when it is zero) and the settings before it, newest first.
    async view(chain: ChainRef, historyLimit: number) {
      const rows = await database
        .select()
        .from(platformFeeSettings)
        .where(eq(platformFeeSettings.chain, chain))
        .orderBy(desc(platformFeeSettings.createdAt))
        .limit(historyLimit);
      const [current, ...before] = rows.map(toChange);
      return {
        current: current ?? null,
        history: before,
        maximumFeeSats,
      };
    },

    // Sets the fee and the address it is paid to, together. The address must be one the chain accepts, and a fee above nothing must
    // be at least what the network relays as an output to that address (a smaller one would stop every claim).
    async change(
      staffUserId: string,
      chain: ChainRef,
      input: { readonly feeSats: bigint; readonly treasury: string },
    ): Promise<SetPlatformFeeResult> {
      const chainPorts = ports(chain);
      if (chainPorts === null) return { code: "chain-unavailable", ok: false };
      let treasury;
      try {
        treasury = chainPorts.addressCodec.parse(chain, input.treasury);
      } catch (error) {
        if (error instanceof InvalidAddressError)
          return { code: "invalid-address", ok: false };
        throw error;
      }
      if (input.feeSats > maximumFeeSats)
        return { code: "above-maximum", limit: maximumFeeSats, ok: false };
      const minimum = chainPorts.addressCodec.minimumOutput(treasury);
      if (input.feeSats > 0n && input.feeSats < minimum)
        return { code: "below-minimum-output", limit: minimum, ok: false };
      const row: Row = {
        chain,
        changedBy: staffUserId,
        createdAt: clock(),
        feeSats: input.feeSats,
        id: newId(),
        treasuryAddress: treasury.value,
      };
      await database.insert(platformFeeSettings).values(row);
      return { change: toChange(row), ok: true };
    },
  };
}

export type PlatformFeeService = ReturnType<typeof createPlatformFeeService>;
