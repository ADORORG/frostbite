import {
  gameChannel,
  methods,
  protocolVersion,
  responseSchema,
  type ErrorCode,
  type JsonValue,
  type MethodName,
  type Params,
  type Result,
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
  dispose(): void;
  readonly milestones: {
    list(): Promise<Result<"milestones.list">["milestones"]>;
    unlock(id: string): Promise<Result<"milestones.unlock">>;
  };
  readonly player: { info(): Promise<Result<"player.info">> };
  readonly progress: {
    load(): Promise<JsonValue | null>;
    save(state: JsonValue): Promise<void>;
  };
  ready(): Promise<Result<"ready">>;
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

  const listener = (event: { data: unknown; source: unknown }) => {
    if (event.source !== host) return;
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
    dispose: () => {
      listenOn.removeEventListener("message", listener);
      for (const pending of waiting.values())
        pending.fail(new GameHostError("unavailable", "The game was closed."));
      waiting.clear();
    },
    milestones: {
      list: async () => (await call("milestones.list", {})).milestones,
      unlock: (id) => call("milestones.unlock", { id }),
    },
    player: { info: () => call("player.info", {}) },
    progress: {
      load: async () => (await call("progress.load", {})).state,
      save: async (state) => void (await call("progress.save", { state })),
    },
    ready: () => call("ready", { sdkVersion }),
  };
}
