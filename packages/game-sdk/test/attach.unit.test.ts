import { describe, expect, it, vi } from "vitest";

import { attachGameHost } from "../src/host.ts";

describe("attaching the host to a game's frame", () => {
  function windowStub() {
    const listeners = new Set<
      (event: { data: unknown; source: unknown }) => void
    >();
    return {
      add: (
        _type: "message",
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.add(listener),
      listeners,
      remove: (
        _type: "message",
        listener: (event: { data: unknown; source: unknown }) => void,
      ) => listeners.delete(listener),
      send: (event: { data: unknown; source: unknown }) =>
        listeners.forEach((listener) => listener(event)),
    };
  }

  it("hands the host only messages from the game's own frame, and stops when detached", async () => {
    const handle = vi.fn(async () => undefined);
    const frame = {};
    const page = windowStub();
    const detach = attachGameHost({
      frame,
      host: { handle },
      listenOn: {
        addEventListener: page.add,
        removeEventListener: page.remove,
      },
    });
    page.send({ data: "from the frame", source: frame });
    page.send({ data: "from another window", source: {} });
    page.send({ data: "from nowhere", source: null });
    expect(handle.mock.calls).toEqual([["from the frame"]]);
    detach();
    expect(page.listeners.size).toBe(0);
    page.send({ data: "after", source: frame });
    expect(handle).toHaveBeenCalledOnce();
  });
});
