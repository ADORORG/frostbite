import type { FetchLike } from "@frostbite/client-http";
import { describe, expect, it, vi } from "vitest";

import { createGalleryApi } from "../src/client/gallery-api.ts";

const answering = (body: object, status = 200) =>
  vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status }));
const empty = { counts: null, mints: [], next: null };

describe("the gallery route as the page reaches it", () => {
  it("asks with a GET of the game, and with the cursor on a later page", async () => {
    const fetchImpl = answering({ ...empty, counts: [] });
    const api = createGalleryApi(fetchImpl);
    await api.list("arcade");
    await api.list(
      "arcade",
      "2026-10-16T00:00:00.000Z_5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60",
    );
    const [first, second] = fetchImpl.mock.calls.map(([path]) => String(path));
    expect(first).toBe("/api/v1/games/gallery?gameId=arcade");
    expect(second).toContain("cursor=2026-10-16T00%3A00%3A00.000Z_5b0c1e7a");
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("refuses an answer that is not the contract's shape, and throws what the requester throws", async () => {
    await expect(
      createGalleryApi(answering({ mints: [{ extra: 1 }] })).list("arcade"),
    ).rejects.toThrow();
    await expect(
      createGalleryApi(answering({}, 500)).list("arcade"),
    ).rejects.toThrow();
  });
});
