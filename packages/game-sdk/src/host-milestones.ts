import type { GameHostBackend, HostedGame, HostEvent } from "./host-types.ts";
import {
  methods,
  verificationSchema,
  type MilestoneStatus,
  type Params,
  type Result,
} from "./protocol.ts";
import { Refusal } from "./refusal.ts";

// How a game's milestones are answered: listed, earned (and counted again when repeatable), reported as progress
// toward a target, and counted. The manifest decides what each allows; the backend keeps the player's records.
export function createMilestoneHandlers(options: {
  readonly backend: GameHostBackend;
  readonly game: HostedGame;
  readonly now: () => Date;
  readonly onEvent?: (event: HostEvent) => void;
  // Records a call against a limit and says whether it is within it.
  readonly within: (kind: "progress" | "unlock", limit: number) => boolean;
  readonly limits: { readonly progress: number; readonly unlock: number };
}) {
  const { backend, game, limits, now, onEvent, within } = options;

  function declared(id: string) {
    const milestone = game.milestones.find((candidate) => candidate.id === id);
    if (milestone === undefined)
      throw new Refusal(
        "unknown_milestone",
        "This game has no such milestone.",
      );
    return milestone;
  }

  return {
    counts: async (): Promise<Result<"milestones.counts">> => {
      const [records, totals] = await Promise.all([
        backend.milestones(),
        backend.counters(),
      ]);
      return {
        counts: game.milestones.map(({ id, maxCount, target }) => ({
          count: records[id]?.count ?? 0,
          current: target === undefined ? null : (totals[id] ?? 0),
          id,
          max: maxCount ?? null,
          target: target ?? null,
        })),
      };
    },
    list: async (): Promise<Result<"milestones.list">> => {
      const unlocked = await backend.milestones();
      const milestones: MilestoneStatus[] = game.milestones.map(
        ({ claimPolicy, criteria, description, id, title }) => {
          const record = unlocked[id];
          return {
            claimPolicy,
            criteria,
            description,
            id,
            status: record === undefined ? "locked" : "unlocked",
            title,
            unlockedAt: record?.unlockedAt ?? null,
            verification:
              record === undefined
                ? null
                : verificationSchema.parse(record.verification),
          };
        },
      );
      return { milestones };
    },
    progress: async (
      params: Params<"milestones.progress">,
    ): Promise<Result<"milestones.progress">> => {
      const { current, id } =
        methods["milestones.progress"].params.parse(params);
      const { target } = declared(id);
      if (target === undefined)
        throw new Refusal(
          "invalid_request",
          "This milestone has no target to report progress toward.",
        );
      if (!within("progress", limits.progress))
        throw new Refusal("rate_limited", "Reporting progress too often.");
      const held = await backend.reportProgress(id, current, target, now());
      onEvent?.({
        current: held.current,
        id,
        target,
        type: "milestone-progress",
      });
      if (held.newlyUnlocked) onEvent?.({ id, type: "milestone-unlocked" });
      return {
        current: held.current,
        status: held.unlockedAt === null ? "locked" : "unlocked",
        target,
        unlockedAt: held.unlockedAt,
      };
    },
    unlock: async (
      params: Params<"milestones.unlock">,
    ): Promise<Result<"milestones.unlock">> => {
      const { id } = methods["milestones.unlock"].params.parse(params);
      const { claimPolicy, maxCount, target } = declared(id);
      // A milestone with a target is earned by reaching it, not by being reported earned.
      if (target !== undefined)
        throw new Refusal(
          "invalid_request",
          "This milestone is earned by reporting progress toward its target.",
        );
      if (!within("unlock", limits.unlock))
        throw new Refusal("rate_limited", "Unlocking too often.");
      const result = await backend.unlock(
        id,
        now(),
        claimPolicy === "repeatable" ? (maxCount ?? 1) : 1,
      );
      if (!result.alreadyUnlocked)
        onEvent?.({ id, type: "milestone-unlocked" });
      else if (result.counted)
        onEvent?.({ count: result.count, id, type: "milestone-counted" });
      return {
        status: result.alreadyUnlocked ? "already-unlocked" : "unlocked",
        unlockedAt: result.unlockedAt,
      };
    },
  };
}
