import { replayForwardedKey } from "./forwarded-keys.ts";
import {
  eventMessageSchema,
  events,
  forwardedKeySchema,
  gameChannel,
  methods,
  protocolVersion,
  responseSchema,
  type ErrorCode,
  type EventData,
  type EventName,
  type JsonValue,
  type MethodName,
  type Params,
  type Result,
  type WalletInfo,
} from "./protocol.ts";

export const sdkVersion = 1;

// A call the platform refused, or could not answer in time. `code` is one of the protocol's error codes.
export class GameHostError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GameHostError";
  }
}

interface MessageSource {
  addEventListener(
    type: "message",
    listener: (event: { data: unknown; source: unknown }) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: { data: unknown; source: unknown }) => void,
  ): void;
}

type MessageListener = (event: { data: unknown; source: unknown }) => void;

// The browser window as a source of messages, reduced to the two fields the protocol uses.
function windowMessages(window: Window): MessageSource {
  const wrapped = new Map<MessageListener, (event: MessageEvent) => void>();
  return {
    addEventListener: (_type, listener) => {
      const forward = (event: MessageEvent) =>
        listener({ data: event.data, source: event.source });
      wrapped.set(listener, forward);
      window.addEventListener("message", forward);
    },
    removeEventListener: (_type, listener) => {
      const forward = wrapped.get(listener);
      if (forward !== undefined) window.removeEventListener("message", forward);
      wrapped.delete(listener);
    },
  };
}

export interface GameClient {
  // What this platform supports: the methods and events it knows, what this game was granted, and the limits.
  // A game written for a newer platform asks first and does without what is missing.
  readonly capabilities: { get(): Promise<Result<"capabilities.get">> };
  dispose(): void;
  readonly milestones: {
    // How many times each milestone has been earned and, for one with a target, the total reported and the target.
    counts(): Promise<Result<"milestones.counts">["counts"]>;
    list(): Promise<Result<"milestones.list">["milestones"]>;
    // Reports the game's current total toward a milestone's target (7 of 10 wins). Send the total, not the change:
    // the platform keeps the larger of it and what it holds, so a repeated or late report cannot count twice, and it
    // earns the milestone when the total reaches the target.
    progress(
      id: string,
      current: number,
    ): Promise<Result<"milestones.progress">>;
    // Asks the platform to start a claim of a milestone the player earned, to be signed with their own wallet in the
    // platform's page. Resolves `requested` (the claim is open; watch `claim.changed`) or `unavailable` with why. Refused
    // with `permission_denied` unless the game declared the `milestone:claim` capability, and rate limited.
    claim(id: string): Promise<Result<"milestones.claim">>;
    // Reports a milestone earned. For a repeatable milestone each call is counted, up to the manifest's maximum;
    // read the count with `counts()`. A milestone with a target is earned through `progress` instead.
    unlock(id: string): Promise<Result<"milestones.unlock">>;
  };
  readonly player: {
    // An opaque id for this player in this game: made in this browser until the player signs in, then the
    // account's. Listen for `player.changed` to learn of the change.
    identity(): Promise<Result<"player.identity">>;
    info(): Promise<Result<"player.info">>;
  };
  readonly progress: {
    load(): Promise<JsonValue | null>;
    save(state: JsonValue): Promise<void>;
  };
  // Listens for something the platform tells the game. Returns a function that stops listening. A message the
  // platform did not send, or in a shape the protocol does not allow, is ignored.
  on<Name extends EventName>(
    name: Name,
    handler: (data: EventData<Name>) => void,
  ): () => void;
  ready(): Promise<Result<"ready">>;
  // Replay-verified runs. Refused with `permission_denied` unless the game declared the `run:submit` capability.
  readonly run: {
    // Asks for a run: `started` with the seed to play it from (a seed the game made itself would let it choose an easy
    // board), or `unavailable` with why (`signed-out`: play on with a local seed; milestones stay self-reported).
    start(): Promise<Result<"run.start">>;
    // Submits the record of a run once. The platform replays it under the game's published rules and answers `verified`
    // (with the milestones it earned), `rejected` (with why) or `refused`. A rejected record spends the run.
    submit(runId: string, record: JsonValue): Promise<Result<"run.submit">>;
  };
  readonly ui: {
    // Asks the platform to show the player a short message. Resolves to whether it was shown.
    toast(message: string): Promise<boolean>;
  };
  // The wallet the player has connected, or null. Refused with `permission_denied` unless the game declared the
  // `wallet` capability in its manifest.
  readonly wallet: {
    // Asks the platform to open its wallet chooser. Resolves to what the platform did: `requested` (the player now
    // chooses; watch `wallet.changed`), `already-connected`, or `unavailable` (this page cannot offer one). Refused
    // with `permission_denied` unless the game declared the `wallet` capability, and rate limited.
    connect(): Promise<"already-connected" | "requested" | "unavailable">;
    get(): Promise<WalletInfo | null>;
  };
}

// The game's side: plain async functions over the one channel to the page that hosts it. The page it talks to
// is `window.parent`; an answer is accepted only from there, only for a request this client made, and only in
// the shape the protocol allows. A call the page does not answer ends with an error instead of waiting forever.
export function createGameClient(
  options: {
    readonly createId?: () => string;
    readonly host?: {
      postMessage(message: unknown, targetOrigin: string): void;
    };
    readonly listenOn?: MessageSource;
    readonly timeoutMs?: number;
  } = {},
): GameClient {
  const host = options.host ?? globalThis.parent;
  const listenOn = options.listenOn ?? windowMessages(globalThis.window);
  const timeoutMs = options.timeoutMs ?? 10_000;
  let counter = 0;
  const createId = options.createId ?? (() => `r${String((counter += 1))}`);
  const waiting = new Map<
    string,
    { fail: (error: GameHostError) => void; succeed: (value: unknown) => void }
  >();

  const handlers = new Map<EventName, Set<(data: never) => void>>();

  function deliver(data: unknown): void {
    const message = eventMessageSchema.safeParse(data);
    if (!message.success) return;
    const { event } = message.data;
    if (!Object.hasOwn(events, event)) return;
    // `Object.hasOwn` above proved the name is a key of the event table.
    const name = event as EventName;
    const parsed = events[name].safeParse(message.data.data);
    if (!parsed.success) return;
    // `parsed` was checked against this event's own schema above, which for a key is `forwardedKeySchema`; parsing it again only gives
    // the compiler the key type, and cannot fail.
    if (name === "key.forwarded")
      replayForwardedKey(
        globalThis.window,
        forwardedKeySchema.parse(parsed.data),
      );
    // Handlers are stored by event name and registered through `on`, which ties each to that name's data type;
    // `parsed` has just been checked against the same name, so the data is what every handler there expects.
    for (const handler of handlers.get(name) ?? [])
      handler(parsed.data as never);
  }

  const listener = (event: { data: unknown; source: unknown }) => {
    if (event.source !== host) return;
    deliver(event.data);
    const response = responseSchema.safeParse(event.data);
    if (!response.success) return;
    const pending = waiting.get(response.data.id);
    if (pending === undefined) return;
    waiting.delete(response.data.id);
    if (response.data.ok) pending.succeed(response.data.result);
    else
      pending.fail(
        new GameHostError(
          response.data.error.code,
          response.data.error.message,
        ),
      );
  };
  listenOn.addEventListener("message", listener);

  function call<Name extends MethodName>(
    name: Name,
    params: Params<Name>,
  ): Promise<Result<Name>> {
    const id = createId();
    return new Promise<Result<Name>>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(
          new GameHostError("unavailable", "The platform did not answer."),
        );
      }, timeoutMs);
      waiting.set(id, {
        fail: (error) => (clearTimeout(timer), reject(error)),
        succeed: (value) => {
          clearTimeout(timer);
          const result = methods[name].result.safeParse(value);
          // `safeParse` has just checked the value against this method's own result schema; indexing the table
          // by a generic name loses that pairing for the compiler, so the cast restores it.
          if (result.success) resolve(result.data as Result<Name>);
          else
            reject(
              new GameHostError("unavailable", "The answer was not valid."),
            );
        },
      });
      host.postMessage(
        {
          channel: gameChannel,
          id,
          method: name,
          params,
          version: protocolVersion,
        },
        "*",
      );
    });
  }

  return {
    capabilities: { get: () => call("capabilities.get", {}) },
    dispose: () => {
      handlers.clear();
      listenOn.removeEventListener("message", listener);
      for (const pending of waiting.values())
        pending.fail(new GameHostError("unavailable", "The game was closed."));
      waiting.clear();
    },
    milestones: {
      claim: (id) => call("milestones.claim", { id }),
      counts: async () => (await call("milestones.counts", {})).counts,
      list: async () => (await call("milestones.list", {})).milestones,
      progress: (id, current) => call("milestones.progress", { current, id }),
      unlock: (id) => call("milestones.unlock", { id }),
    },
    player: {
      identity: () => call("player.identity", {}),
      info: () => call("player.info", {}),
    },
    progress: {
      load: async () => (await call("progress.load", {})).state,
      save: async (state) => void (await call("progress.save", { state })),
    },
    on: (name, handler) => {
      const set = handlers.get(name) ?? new Set<(data: never) => void>();
      set.add(handler);
      handlers.set(name, set);
      return () => void set.delete(handler);
    },
    ready: () => call("ready", { sdkVersion }),
    run: {
      start: () => call("run.start", {}),
      submit: (runId, record) => call("run.submit", { record, runId }),
    },
    ui: {
      toast: async (message) => (await call("ui.toast", { message })).shown,
    },
    wallet: {
      connect: async () => (await call("wallet.connect", {})).status,
      get: async () => (await call("wallet.get", {})).wallet,
    },
  };
}
