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
  type EventMessage,
  type MethodName,
  type Request,
  type Response,
} from "./protocol.ts";
import { defaultGameHostPolicy, type GameHostPolicy } from "./policy.ts";
export type {
  GameHost,
  GameHostBackend,
  HostedGame,
  HostEvent,
  HostServices,
} from "./host-types.ts";
import type {
  GameHost,
  GameHostBackend,
  HostedGame,
  HostEvent,
  HostServices,
} from "./host-types.ts";
import { createMilestoneHandlers } from "./host-milestones.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { Refusal } from "./refusal.ts";

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
  const { within } = createRateLimiter(now, [
    "connect",
    "progress",
    "save",
    "toast",
    "unlock",
  ]);
  const milestones = createMilestoneHandlers({
    backend,
    game,
    limits: {
      progress: policy.progressCallsPerMinute,
      unlock: policy.unlockCallsPerMinute,
    },
    now,
    onEvent,
    within,
  });

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
      case "player.identity":
        return backend.identity();
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
      case "wallet.connect": {
        if (!within("connect", policy.connectCallsPerMinute))
          throw new Refusal("rate_limited", "Asking to connect too often.");
        if (services?.wallet?.() != null)
          return { status: "already-connected" };
        const open = services?.connectWallet;
        if (open === undefined) return { status: "unavailable" };
        open();
        return { status: "requested" };
      }
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
      case "milestones.counts":
        return milestones.counts();
      case "milestones.list":
        return milestones.list();
      case "milestones.progress":
        return milestones.progress(
          methods["milestones.progress"].params.parse(params),
        );
      case "milestones.unlock":
        return milestones.unlock(
          methods["milestones.unlock"].params.parse(params),
        );
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
