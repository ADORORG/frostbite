import type { MilestoneLevel, MilestoneRules } from "@frostbite/game-saves";
import type { ShareRequest } from "@frostbite/shared/games";

import type {
  GameShareRepository,
  SharedThing,
  StoredShare,
} from "./repository.ts";

type Refusal =
  | { readonly kind: "unknown-game" }
  | { readonly kind: "unknown-milestone" }
  // The account does not hold the milestone, so there is nothing true to show.
  | { readonly kind: "not-earned" };

export type ShareOutcome =
  { readonly kind: "shared"; readonly share: StoredShare } | Refusal;

export interface GameSharesService {
  create(userId: string, request: ShareRequest): Promise<ShareOutcome>;
  // The public view of a live share, or null for one that never was, was ended, or is not an identifier.
  get(id: string): Promise<SharedThing | null>;
  // The same, with whose it is, for the server that builds the page: the owner is what its pictures and counts are read for, and is never
  // sent to a visitor.
  find(
    id: string,
  ): Promise<{ readonly owner: string; readonly thing: SharedThing } | null>;
  revoke(userId: string, id: string): Promise<boolean>;
}

// Turns what a player asks to share into a link, checking the platform's own records first: the game must be listed, a milestone must be
// one the game declares and the account must hold it (its level is read from the account, never from the request), and a score is always
// self-reported, because no replay verifier returns one. Asking for the same thing again returns the same link.
export function createGameSharesService(options: {
  readonly clock: () => Date;
  // The listed games and the milestones each declares: the same map the sync service is given.
  readonly games: ReadonlyMap<string, MilestoneRules>;
  readonly level: (input: {
    readonly gameId: string;
    readonly milestoneId: string;
    readonly userId: string;
  }) => Promise<MilestoneLevel | null>;
  readonly newId: () => string;
  readonly repository: GameShareRepository;
}): GameSharesService {
  async function thingFor(
    userId: string,
    request: ShareRequest,
  ): Promise<
    | { readonly ok: true; readonly thing: SharedThing }
    | { readonly ok: false; readonly outcome: Refusal }
  > {
    if (request.kind === "milestones") return { ok: true, thing: request };
    const rules = options.games.get(request.gameId);
    if (rules === undefined)
      return { ok: false, outcome: { kind: "unknown-game" } };
    if (request.kind === "score")
      return {
        ok: true,
        thing: { ...request, verification: "self-reported" },
      };
    if (!rules.has(request.milestoneId))
      return { ok: false, outcome: { kind: "unknown-milestone" } };
    const verification = await options.level({
      gameId: request.gameId,
      milestoneId: request.milestoneId,
      userId,
    });
    return verification === null
      ? { ok: false, outcome: { kind: "not-earned" } }
      : { ok: true, thing: { ...request, verification } };
  }
  return {
    create: async (userId, request) => {
      const checked = await thingFor(userId, request);
      if (!checked.ok) return checked.outcome;
      return {
        kind: "shared",
        share: await options.repository.createOrGet({
          createdAt: options.clock(),
          id: options.newId(),
          thing: checked.thing,
          userId,
        }),
      };
    },
    get: async (id) => (await options.repository.get(id))?.thing ?? null,
    find: async (id) => {
      const share = await options.repository.get(id);
      return share === null
        ? null
        : { owner: share.userId, thing: share.thing };
    },
    revoke: (userId, id) =>
      options.repository.revoke(userId, id, options.clock()),
  };
}
