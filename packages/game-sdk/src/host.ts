import {
  eventNames,
  events,
  gameChannel,
  methodNames,
  methods,
  protocolVersion,
  requestSchema,
  requiredCapability,
  requiredEventCapability,
  toastMaxLength,
  type ErrorCode,
  type EventData,
  type EventMessage,
  type EventName,
  type JsonValue,
  type MethodName,
  type MilestoneStatus,
  type PlayerInfo,
  type Request,
  type Response,
  type WalletInfo,
  verificationSchema,
} from "./protocol.ts";
import { defaultGameHostPolicy, type GameHostPolicy } from "./policy.ts";
import { createRateLimiter } from "./rate-limit.ts";

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

// The parts of a game's manifest the host needs: who it is, what it asked for, and which milestones it
// declared. A game that declares no capabilities is granted none.
export interface HostedGame {
  readonly capabilities?: readonly string[];
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

// What the page lends a game, beyond the player's saved state. Each is optional: a page that cannot offer it
// says so truthfully (no wallet, nothing shown) rather than pretending.
export interface HostServices {
  // Shows the player a short plain-text message from the game.
  toast?(message: string): void;
  // The wallet the player has connected right now, or none.
  wallet?(): WalletInfo | null;
}

export interface GameHost {
  // Tells the game something happened. Sent only after the game has called `ready`, and, for the wallet, only
  // when the game declared the capability. The data is checked before it leaves.
  emit<Name extends EventName>(name: Name, data: EventData<Name>): void;
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

// The host side of the conversation. It answers only what the protocol lists, refuses anything else, checks
// every value in both directions, and keeps a game from saving too much or calling too often. A failure in the
// backend is reported as `unavailable` and never leaks its reason to the game.
export function createGameHost(options: {
  readonly backend: GameHostBackend;
  readonly game: HostedGame;
  readonly now?: () => Date;
  readonly onEvent?: (event: HostEvent) => void;
  readonly policy?: GameHostPolicy;
  // Sends a message the game did not ask for. Without it the host answers only what is asked.
  readonly push?: (message: EventMessage) => void;
  readonly reply: (response: Response) => void;
  readonly services?: HostServices;
}): GameHost {
  const { backend, game, onEvent, push, reply, services } = options;
  const granted = new Set(game.capabilities ?? []);
  const now = options.now ?? (() => new Date());
  const policy = options.policy ?? defaultGameHostPolicy;
  let ready = false;
  const { within } = createRateLimiter(now, ["save", "toast", "unlock"]);

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
      case "capabilities.get":
        return {
          events: eventNames,
          granted: [...granted],
          limits: {
            progressMaxBytes: policy.progressMaxBytes,
            toastMaxLength,
          },
          methods: methodNames,
          protocolVersion,
        };
      case "player.info":
        return backend.player();
      case "ui.toast": {
        const { message } = methods["ui.toast"].params.parse(params);
        if (!within("toast", policy.toastCallsPerMinute))
          throw new Refusal("rate_limited", "Showing messages too often.");
        const show = services?.toast;
        show?.(message);
        return { shown: show !== undefined };
      }
      case "wallet.get":
        return { wallet: services?.wallet?.() ?? null };
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
    emit: (name, data) => {
      if (!ready || push === undefined) return;
      const needs = requiredEventCapability[name];
      if (needs !== undefined && !granted.has(needs)) return;
      push({
        channel: gameChannel,
        data: events[name].parse(data),
        event: name,
        version: protocolVersion,
      });
    },
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
      const needs = requiredCapability[name];
      if (needs !== undefined && !granted.has(needs))
        return refuse(
          "permission_denied",
          "This game did not ask for that in its manifest.",
        );
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
