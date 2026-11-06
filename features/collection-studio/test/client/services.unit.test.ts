import { idempotencyKeySchema } from "@frostbite/shared/http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBrowserServices } from "../../src/client/services.ts";

afterEach(() => vi.unstubAllGlobals());

describe("browser services", () => {
  it("creates valid, distinct idempotency keys", () => {
    const services = createBrowserServices();
    const first = services.createIdempotencyKey();
    const second = services.createIdempotencyKey();
    expect(idempotencyKeySchema.safeParse(first).success).toBe(true);
    expect(first).not.toBe(second);
  });

  it("calls the API with the session cookie for the same origin", async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_input: string, init: RequestInit) => {
      seen.push(init);
      return new Response(JSON.stringify({ collections: [] }), { status: 200 });
    });
    await createBrowserServices().api.list();
    expect(seen[0]?.credentials).toBe("same-origin");
  });

  it("navigates by moving the browser to the address", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    createBrowserServices().navigate("/studio/collections/abc");
    expect(assign).toHaveBeenCalledWith("/studio/collections/abc");
  });

  it("lets a test replace any part", () => {
    const createIdempotencyKey = () =>
      idempotencyKeySchema.parse("replaced-key-0000001");
    expect(
      createBrowserServices({ createIdempotencyKey }).createIdempotencyKey(),
    ).toBe("replaced-key-0000001");
  });
});
