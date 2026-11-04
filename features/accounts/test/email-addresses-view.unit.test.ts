import { describe, expect, it, vi } from "vitest";

import { emailAddressesView } from "../src/application/email-addresses-view.ts";

describe("the account's email addresses as shown", () => {
  it("keeps the order given, writes each time as text, and says how many may be held", async () => {
    const addresses = vi.fn(async () => ({
      addresses: [
        { addedAt: new Date("2026-10-01T09:30:00.000Z"), value: "old@b.co" },
        { addedAt: new Date("2026-10-02T10:00:00.000Z"), value: "new@b.co" },
      ],
      maximum: 4,
    }));
    expect(await emailAddressesView({ addresses }, "user-1")).toEqual({
      addresses: [
        { addedAt: "2026-10-01T09:30:00.000Z", address: "old@b.co" },
        { addedAt: "2026-10-02T10:00:00.000Z", address: "new@b.co" },
      ],
      maximum: 4,
    });
    expect(addresses).toHaveBeenCalledWith("user-1", "email");
  });

  it("is an empty list, with the limit, for an account with no address", async () => {
    expect(
      await emailAddressesView(
        { addresses: async () => ({ addresses: [], maximum: 5 }) },
        "user-1",
      ),
    ).toEqual({ addresses: [], maximum: 5 });
  });
});
