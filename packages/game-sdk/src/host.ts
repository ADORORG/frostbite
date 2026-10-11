import {
  gameChannel,
  methods,
  protocolVersion,
  requestSchema,
  type ErrorCode,
  type JsonValue,
  type MethodName,
  type MilestoneStatus,
  type PlayerInfo,
  type Request,
  type Response,
  verificationSchema,
} from "./protocol.ts";
import { defaultGameHostPolicy, type GameHostPolicy } from "./policy.ts";

// What the host keeps for a player on behalf of a game. The host owns storage and, later, the account; a game
// never sees where this lives.
export interface GameHostBackend {
  loadProgress(): Promise<JsonValue | null>;
  milestones(): Promise<
    Readonly<
      Record<string, { unlockedAt: string; verification: "self-reported" }>
    >
  >;
  player(): PlayerInfo;
  saveProgress(state: JsonValue, now: Date): Promise<void>;
  unlock(
    id: string,
    now: Date,
  ): Promise<{ alreadyUnlocked: boolean; unlockedAt: string }>;
}

// The parts of a game's manifest the host needs: who it is and which milestones it declared.
export interface HostedGame {
  readonly id: string;
  readonly milestones: readonly {
    readonly claimPolicy: "once" | "repeatable";
    readonly criteria: string;
    readonly description: string;
    readonly id: string;
    readonly title: string;
  }[];
}

// What the page shows the player as it happens.
export type HostEvent =
  | { readonly type: "ready" }
  | { readonly type: "progress-saved"; readonly savedAt: string }
  | { readonly id: string; readonly type: "milestone-unlocked" }
  | {
      readonly code: ErrorCode;
      readonly method: string;
      readonly type: "refused";
    };

export interface GameHost {
  // One message from the game's frame. The caller has already checked it came from that frame.
  handle(data: unknown): Promise<void>;
}

class Refusal extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const minuteMs = 60_000;

// The host side of the conversation. It answers only what the protocol lists, refuses anything else, checks
// every value in both directions, and keeps a game from saving too much or calling too often. A failure in the
// backend is reported as `unavailable` and never leaks its reason to the game.
export function createGameHost(options: {
  readonly backend: GameHostBackend;
  readonly game: HostedGame;
  readonly now?: () => Date;
  readonly onEvent?: (event: HostEvent) => void;
  readonly policy?: GameHostPolicy;
  readonly reply: (response: Response) => void;
}): GameHost {
  const { backend, game, onEvent, reply } = options;
  const now = options.now ?? (() => new Date());
  const policy = options.policy ?? defaultGameHostPolicy;
  let ready = false;
  const calls: Record<"save" | "unlock", number[]> = { save: [], unlock: [] };

  function within(kind: "save" | "unlock", limit: number): boolean {
    const at = now().getTime();
    const recent = calls[kind].filter((time) => at - time < minuteMs);
    if (recent.length >= limit) {
      calls[kind] = recent;
      return false;
    }
    calls[kind] = [...recent, at];
    return true;
  }

  async function run(name: MethodName, params: unknown): Promise<unknown> {
    switch (name) {
      case "ready": {
        methods.ready.params.parse(params);
        ready = true;
        onEvent?.({ type: "ready" });
        return {
          gameId: game.id,
          limits: { progressMaxBytes: policy.progressMaxBytes },
          player: backend.player(),
          protocolVersion,
        };
      }
      case "player.info":
        return backend.player();
      case "progress.load":
        return { state: await backend.loadProgress() };
      case "progress.save": {
        const { state } = methods["progress.save"].params.parse(params);
        if (
          new TextEncoder().encode(JSON.stringify(state)).length >
          policy.progressMaxBytes
        )
          throw new Refusal("too_large", "The saved state is too large.");
        if (!within("save", policy.saveCallsPerMinute))
          throw new Refusal("rate_limited", "Saving too often.");
        const savedAt = now();
        await backend.saveProgress(state, savedAt);
        onEvent?.({ savedAt: savedAt.toISOString(), type: "progress-saved" });
        return { savedAt: savedAt.toISOString() };
      }
      case "milestones.list": {
        const unlocked = await backend.milestones();
        const milestones: MilestoneStatus[] = game.milestones.map(
          (milestone) => {
            const record = unlocked[milestone.id];
            return {
              ...milestone,
              status: record === undefined ? "locked" : "unlocked",
              unlockedAt: record?.unlockedAt ?? null,
              verification:
                record === undefined
                  ? null
                  : verificationSchema.parse(record.verification),
            };
          },
        );
        return { milestones };
      }
      case "milestones.unlock": {
        const { id } = methods["milestones.unlock"].params.parse(params);
        if (!game.milestones.some((milestone) => milestone.id === id))
          throw new Refusal(
            "unknown_milestone",
            "This game has no such milestone.",
          );
        if (!within("unlock", policy.unlockCallsPerMinute))
          throw new Refusal("rate_limited", "Unlocking too often.");
        const result = await backend.unlock(id, now());
        if (!result.alreadyUnlocked)
          onEvent?.({ id, type: "milestone-unlocked" });
        return {
          status: result.alreadyUnlocked ? "already-unlocked" : "unlocked",
          unlockedAt: result.unlockedAt,
        };
      }
    }
  }

  function answer(
    request: Request,
    outcome:
      { ok: true; result: unknown } | { code: ErrorCode; message: string },
  ) {
    const base = {
      channel: gameChannel,
      id: request.id,
      version: protocolVersion,
    } as const;
    reply(
      "ok" in outcome
        ? { ...base, ok: true, result: outcome.result }
        : {
            ...base,
            error: { code: outcome.code, message: outcome.message },
            ok: false,
          },
    );
  }

  return {
    handle: async (data) => {
      const parsed = requestSchema.safeParse(data);
      // Not part of this conversation (another script's message, or not shaped like one): not answered.
      if (!parsed.success) return;
      const request = parsed.data;
      const refuse = (code: ErrorCode, message: string) => {
        onEvent?.({ code, method: request.method, type: "refused" });
        answer(request, { code, message });
      };
      if (!Object.hasOwn(methods, request.method))
        return refuse("unknown_method", "Unknown method.");
      // `Object.hasOwn` above proved the name is a key of the method table.
      const name = request.method as MethodName;
      if (name !== "ready" && !ready)
        return refuse("not_ready", "Call ready first.");
      if (!methods[name].params.safeParse(request.params).success)
        return refuse("invalid_request", "The parameters are not valid.");
      try {
        const result = methods[name].result.parse(
          await run(name, request.params),
        );
        answer(request, { ok: true, result });
      } catch (error) {
        if (error instanceof Refusal) return refuse(error.code, error.message);
        refuse("unavailable", "The platform could not do that.");
      }
    },
  };
}

// Connects a host to a game's frame in a page: messages are handled only when they came from that frame (a
// sandboxed frame has no origin to check, so the frame itself is the identity), and answers go back to it.
export function attachGameHost(options: {
  readonly frame: unknown;
  readonly host: GameHost;
  readonly listenOn: {
    addEventListener(
      type: "message",
      listener: (event: { data: unknown; source: unknown }) => void,
    ): void;
    removeEventListener(
      type: "message",
      listener: (event: { data: unknown; source: unknown }) => void,
    ): void;
  };
}): () => void {
  const listener = (event: { data: unknown; source: unknown }) => {
    if (event.source === options.frame) void options.host.handle(event.data);
  };
  options.listenOn.addEventListener("message", listener);
  return () => options.listenOn.removeEventListener("message", listener);
}
