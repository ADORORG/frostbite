import { ApiError } from "@frostbite/client-http";
import { describe, expect, it } from "vitest";

import { signOut } from "../src/client/sign-out.ts";

describe("signing out", () => {
  it("asks the server to end the session, with an empty body, and says nothing went wrong when it did", async () => {
    const asked: { body: unknown; path: string }[] = [];
    const outcome = await signOut(async (route, _schema, options) => {
      asked.push({ body: options?.body, path: route.path });
      return { changed: true } as never;
    });
    expect(outcome).toBeNull();
    expect(asked).toEqual([{ body: {}, path: "/api/v1/auth/sign-out" }]);
  });

  it.each([
    [new ApiError("network", null, "x"), "network"],
    [new ApiError("rate_limited", null, "x"), "rate-limited"],
    [new ApiError("unauthorized", null, "x"), "signed-out"],
    [
      new ApiError("conflict", 409, "x", null, "wallet-missing"),
      "wallet-missing",
    ],
  ])(
    "says why it did not (%#): the outcome the server's answer stands for",
    async (error, outcome) => {
      expect(
        await signOut(() => {
          throw error;
        }),
      ).toBe(outcome);
    },
  );

  it("does not hide a mistake that is not a failed request", async () => {
    await expect(
      signOut(() => {
        throw new TypeError("a bug");
      }),
    ).rejects.toThrow("a bug");
  });
});
