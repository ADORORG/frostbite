import type { GameHost } from "./host.ts";

// Connects a host to a game's frame in a page: messages are handled only when they came from that frame (a
// sandboxed frame has no origin to check, so the frame itself is the identity), and answers go back to it.
export function attachGameHost(options: {
  readonly frame: unknown;
  readonly host: Pick<GameHost, "handle">;
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
