import type { MintCursor } from "@frostbite/game-claims";
import type { HttpOperation } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";
import {
  gameAdminCapability,
  gameAdminMintRoutes,
  gameMintsPageSize,
  getPlatformFeeInputSchema,
  getPlatformFeeResponseSchema,
  listGameMintsInputSchema,
  listGameMintsResponseSchema,
  listGameMintTotalsInputSchema,
  listGameMintTotalsResponseSchema,
  setPlatformFeeInputSchema,
  setPlatformFeeResponseSchema,
  type GetPlatformFeeResponse,
  type ListGameMintsInput,
  type ListGameMintsResponse,
  type ListGameMintTotalsResponse,
  type SetPlatformFeeInput,
  type SetPlatformFeeResponse,
} from "@frostbite/shared/games";
import { chainRefSchema } from "@frostbite/shared/chain";

import type { GameAdminRuntime } from "../runtime.ts";

type Resolve = () => Promise<GameAdminRuntime>;

const access = { capability: gameAdminCapability, kind: "platform" } as const;
const base = {
  access,
  applicationErrors: ["unauthorized"],
  idempotency: "none",
} as const;
// Only a read states how it may be cached; what staff are shown is never kept.
const read = { ...base, cache: { kind: "no-store" } } as const;

const cursorOf = (cursor: MintCursor | null): string | null =>
  cursor === null
    ? null
    : `${cursor.completedAt.toISOString()}~${cursor.claimId}`;
function parseCursor(text: string | undefined): MintCursor | undefined {
  if (text === undefined) return undefined;
  const [completedAt, claimId] = text.split("~");
  return completedAt === undefined || claimId === undefined
    ? undefined
    : { claimId, completedAt: new Date(completedAt) };
}

// A game's mints: its totals, and a page of its completed ones, newest first. A game the platform does not administer has none.
export function createListGameMintsOperation(resolve: Resolve) {
  return {
    ...read,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { games, mints } = await resolve();
      if (!games.some(({ id }) => id === input.gameId))
        return {
          ok: true,
          value: {
            mints: [],
            next: null,
            totals: { completed: 0, feesAccruedUnits: "0", inProgress: 0 },
          },
        } as const;
      const [[totals], page] = await Promise.all([
        mints.totalsFor([input.gameId]),
        mints.recent(input.gameId, gameMintsPageSize, parseCursor(input.after)),
      ]);
      return {
        ok: true,
        value: {
          mints: page.mints.map((mint) => ({
            claimId: mint.claimId,
            completedAt: mint.completedAt.toISOString(),
            milestoneId: mint.milestoneId,
            platformFeeUnits: mint.platformFeeSats.toString(),
            transactionId: mint.transactionId,
            wallet: mint.walletAddress,
          })),
          next: cursorOf(page.next),
          totals: {
            completed: totals?.completed ?? 0,
            feesAccruedUnits: (totals?.feesAccruedSats ?? 0n).toString(),
            inProgress: totals?.inProgress ?? 0,
          },
        },
      } as const;
    },
    input: "query",
    inputSchema: listGameMintsInputSchema,
    outputSchema: listGameMintsResponseSchema,
    ...gameAdminMintRoutes.mints,
  } satisfies HttpOperation<ListGameMintsInput, ListGameMintsResponse>;
}

// The totals of every game that declares rewards, for the list of them: a row each, however many mints there are.
export function createListGameMintTotalsOperation(resolve: Resolve) {
  return {
    ...read,
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { games, mints } = await resolve();
      const totals = await mints.totalsFor(games.map(({ id }) => id));
      return {
        ok: true,
        value: {
          games: totals.map((row) => ({
            completed: row.completed,
            feesAccruedUnits: row.feesAccruedSats.toString(),
            gameId: row.gameId,
            inProgress: row.inProgress,
          })),
        },
      } as const;
    },
    input: "none",
    inputSchema: listGameMintTotalsInputSchema,
    outputSchema: listGameMintTotalsResponseSchema,
    ...gameAdminMintRoutes.mintTotals,
  } satisfies HttpOperation<Record<string, never>, ListGameMintTotalsResponse>;
}

const historyLength = 20;

// The platform's fee on claims, for each chain the games declared: the one in force and the settings before it.
export function createGetPlatformFeeOperation(resolve: Resolve) {
  return {
    ...read,
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { fees, games, names } = await resolve();
      const chains = [...new Set(games.map(({ chain }) => chain))].sort();
      const views = await Promise.all(
        chains.map(async (chain) => ({
          chain,
          view: await fees.view(chain, historyLength + 1),
        })),
      );
      const people = await names(
        views.flatMap(({ view }) =>
          [view.current, ...view.history].flatMap((change) =>
            change?.changedBy == null ? [] : [change.changedBy],
          ),
        ),
      );
      const wire = (
        change: NonNullable<(typeof views)[number]["view"]["current"]>,
      ) => ({
        changedAt: change.changedAt.toISOString(),
        changedBy:
          change.changedBy === null
            ? null
            : (people.get(change.changedBy) ?? null),
        feeUnits: change.feeSats.toString(),
        treasury: change.treasury,
      });
      return {
        ok: true,
        value: {
          chains: views.map(({ chain, view }) => ({
            chain,
            current: view.current === null ? null : wire(view.current),
            history: view.history.slice(0, historyLength).map(wire),
            maximumFeeUnits: view.maximumFeeSats.toString(),
          })),
        },
      } as const;
    },
    input: "none",
    inputSchema: getPlatformFeeInputSchema,
    outputSchema: getPlatformFeeResponseSchema,
    ...gameAdminMintRoutes.platformFee,
  } satisfies HttpOperation<Record<string, never>, GetPlatformFeeResponse>;
}

// Sets the fee and its treasury address together, as the signed-in staff member. A chain no game is on is refused, so the setting
// cannot name a chain nothing will ever read it for. The refusal says which rule was crossed, and the limit where there is one.
export function createSetPlatformFeeOperation(resolve: Resolve) {
  const respond = (value: SetPlatformFeeResponse) =>
    ({ ok: true, value }) as const;
  return {
    ...base,
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const { fees, games, names } = await resolve();
      const chain = chainRefSchema.parse(input.chain);
      if (!games.some((game) => game.chain === chain))
        return respond({ reason: "unknown-chain", status: "refused" });
      const outcome = await fees.change(context.actorUserId, chain, {
        feeSats: BigInt(input.feeUnits),
        treasury: input.treasury,
      });
      if (!outcome.ok)
        return respond({
          ...(outcome.limit === undefined
            ? {}
            : { limitUnits: outcome.limit.toString() }),
          reason: outcome.code,
          status: "refused",
        });
      const who = await names([context.actorUserId]);
      return respond({
        setting: {
          changedAt: outcome.change.changedAt.toISOString(),
          changedBy: who.get(context.actorUserId) ?? null,
          feeUnits: outcome.change.feeSats.toString(),
          treasury: outcome.change.treasury,
        },
        status: "saved",
      });
    },
    input: "json",
    inputSchema: setPlatformFeeInputSchema,
    outputSchema: setPlatformFeeResponseSchema,
    ...gameAdminMintRoutes.setPlatformFee,
  } satisfies HttpOperation<SetPlatformFeeInput, SetPlatformFeeResponse>;
}
