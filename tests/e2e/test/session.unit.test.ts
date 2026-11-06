import { platformSessionCookieName } from "@frostbite/shared/auth";
import { describe, expect, it, vi } from "vitest";

import { type E2ESessionContext, useE2ESession } from "../src/session.ts";

describe("useE2ESession", () => {
  it("clears prior state and installs the host-only platform cookie", async () => {
    const context = {
      addCookies: vi.fn<E2ESessionContext["addCookies"]>(async () => {}),
      clearCookies: vi.fn<E2ESessionContext["clearCookies"]>(async () => {}),
    };

    await useE2ESession(context, "https://launch.example.test:4173", "token");

    expect(context.clearCookies).toHaveBeenCalledOnce();
    expect(context.addCookies).toHaveBeenCalledWith([
      {
        domain: "launch.example.test",
        httpOnly: true,
        name: platformSessionCookieName,
        path: "/",
        sameSite: "Lax",
        secure: true,
        value: "token",
      },
    ]);
  });
});
