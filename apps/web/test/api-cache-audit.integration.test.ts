import { isNamedLikeARead } from "@frostbite/http/registered-operation";
import { describe, expect, it, vi } from "vitest";

// A request with no session cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { platformComposition } from "@repo/configs/platform";
import { GET } from "../src/app/api/v1/[...segments]/route.js";

async function operations() {
  const entrypoints = await platformComposition.features.loadAll();
  return entrypoints.flatMap(({ operations: contributed = [] }) => contributed);
}

// What the platform answers on every route, as it is actually composed. A rule that held only for the operations a test built by hand
// would say nothing about the ones that ship.
describe("how the platform's routes are kept", () => {
  it("has every read as a GET that states how it is kept, and no write that does", async () => {
    const registered = await operations();
    expect(registered.length).toBeGreaterThan(30);
    for (const { cache, route } of registered)
      expect([route.operationId, route.method === "GET"]).toEqual([
        route.operationId,
        cache !== undefined,
      ]);
  });

  it("has no read as a POST except the ones that name a reason", async () => {
    const readsSentAsPost = (await operations())
      .filter(
        ({ route }) =>
          route.method !== "GET" && isNamedLikeARead(route.operationId),
      )
      .map(({ route }) => route.operationId);
    // Searching people by what an administrator types, which can be an email address that must not be in an address.
    expect(readsSentAsPost).toEqual(["findPlatformRoleCandidates"]);
  });

  it("never keeps what someone staff-only or private read: nothing signed-in reads is cached for everyone", async () => {
    for (const { access, cache, route } of await operations())
      if (route.method === "GET" && access.kind !== "public")
        expect([route.operationId, cache?.kind === "max-age"]).toEqual([
          route.operationId,
          route.operationId === "getMintedPicture",
        ]);
  });

  it("answers an unknown route, and a private one with no session, without letting either be kept", async () => {
    const call = (segments: string[]) =>
      GET(new Request(`http://platform.invalid/api/v1/${segments.join("/")}`), {
        params: Promise.resolve({ segments }),
      });
    const unknown = await call(["no", "such", "route"]);
    expect(unknown.status).toBe(404);
    expect(unknown.headers.get("cache-control")).toBe("no-store");
    const unauthorized = await call(["games", "claims", "list"]);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("cache-control")).toBe("no-store");
  });
});
