import { contactCodes } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  clock,
  database,
  issueInput,
  limits,
  repository,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

const at = (offsetMs: number) => new Date(start.getTime() + offsetMs);
const take = (now = clock.now, destination = "ada@example.com") =>
  repository.takeAttempt({
    destination,
    kind: "email",
    maximumAttempts: 5,
    now,
  });

describe("issuing a code", () => {
  it("records it, and replaces the older live codes so only the newest works", async () => {
    const first = issueInput({ id: "00000000-0000-7000-8000-000000000001" });
    expect(await repository.issue(first)).toEqual({ kind: "issued" });
    const second = issueInput({
      id: "00000000-0000-7000-8000-000000000002",
      issuedAt: at(limits.cooldownMs),
    });
    expect(await repository.issue(second)).toEqual({ kind: "issued" });
    expect((await take(at(limits.cooldownMs)))?.id).toBe(second.id);
    const [older] = await database
      .select()
      .from(contactCodes)
      .where(eq(contactCodes.id, first.id));
    expect(older?.consumedAt).toEqual(second.issuedAt);
  });

  it("holds a destination to the cooldown, to the millisecond", async () => {
    await repository.issue(issueInput());
    expect(
      await repository.issue(
        issueInput({ issuedAt: at(limits.cooldownMs - 1) }),
      ),
    ).toEqual({ kind: "cooldown", retryAfterMs: 1 });
    expect(await repository.issue(issueInput({ issuedAt: at(0) }))).toEqual({
      kind: "cooldown",
      retryAfterMs: limits.cooldownMs,
    });
    expect(
      await repository.issue(issueInput({ issuedAt: at(limits.cooldownMs) })),
    ).toEqual({ kind: "issued" });
  });

  it("holds a destination to the sends allowed in the window, and says when the oldest leaves it", async () => {
    const quick = { ...limits, cooldownMs: 1 };
    for (const offset of [0, 10, 20])
      expect(
        await repository.issue(
          issueInput({ issuedAt: at(offset), limits: quick }),
        ),
      ).toEqual({ kind: "issued" });
    expect(
      await repository.issue(issueInput({ issuedAt: at(30), limits: quick })),
    ).toEqual({
      kind: "limit",
      retryAfterMs: limits.windowMs - 30,
    });
  });

  it("stops counting a send once it is a full window old", async () => {
    const quick = { ...limits, cooldownMs: 1 };
    for (const offset of [0, 10, 20])
      await repository.issue(
        issueInput({ issuedAt: at(offset), limits: quick }),
      );
    // At exactly one window after the first, the first no longer counts; a millisecond earlier it still does.
    expect(
      (
        await repository.issue(
          issueInput({ issuedAt: at(limits.windowMs - 1), limits: quick }),
        )
      ).kind,
    ).toBe("limit");
    expect(
      (
        await repository.issue(
          issueInput({ issuedAt: at(limits.windowMs), limits: quick }),
        )
      ).kind,
    ).toBe("issued");
  });

  it("keeps destinations, and kinds, apart", async () => {
    await repository.issue(issueInput());
    expect(
      (await repository.issue(issueInput({ destination: "grace@example.com" })))
        .kind,
    ).toBe("issued");
    expect((await repository.issue(issueInput({ kind: "phone" }))).kind).toBe(
      "issued",
    );
  });

  it("lets only one of several simultaneous requests for a destination through", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => repository.issue(issueInput())),
    );
    expect(results.filter(({ kind }) => kind === "issued")).toHaveLength(1);
    expect(results.filter(({ kind }) => kind === "cooldown")).toHaveLength(5);
    expect(await database.select().from(contactCodes)).toHaveLength(1);
  });

  it("forgets a discarded code, so a failed send leaves nothing to wait for", async () => {
    const input = issueInput();
    await repository.issue(input);
    await repository.discard(input.id);
    expect(await take()).toBeNull();
    expect((await repository.issue(issueInput())).kind).toBe("issued");
  });
});

describe("trying a code", () => {
  it("gives back the live code and counts the try", async () => {
    const input = issueInput({ codeHash: "c".repeat(64), salt: "s1" });
    await repository.issue(input);
    expect(await take()).toEqual({
      codeHash: "c".repeat(64),
      id: input.id,
      salt: "s1",
    });
    const [row] = await database.select().from(contactCodes);
    expect(row?.attempts).toBe(1);
  });

  it("gives it back five times and no more, even to the right code", async () => {
    await repository.issue(issueInput());
    for (let attempt = 0; attempt < 5; attempt += 1)
      expect(await take()).not.toBeNull();
    expect(await take()).toBeNull();
    const [row] = await database.select().from(contactCodes);
    expect(row?.attempts).toBe(5);
  });

  it("spends no more than the allowed tries when many arrive together", async () => {
    await repository.issue(issueInput());
    const held = await Promise.all(Array.from({ length: 12 }, () => take()));
    expect(held.filter((code) => code !== null)).toHaveLength(5);
  });

  it("stops at the moment of expiry", async () => {
    const input = issueInput();
    await repository.issue(input);
    expect(await take(new Date(input.expiresAt.getTime() - 1))).not.toBeNull();
    expect(await take(input.expiresAt)).toBeNull();
  });

  it("finds nothing for another destination, another kind, or a code already used", async () => {
    const input = issueInput();
    await repository.issue(input);
    expect(await take(clock.now, "grace@example.com")).toBeNull();
    expect(
      await repository.takeAttempt({
        destination: "ada@example.com",
        kind: "phone",
        maximumAttempts: 5,
        now: clock.now,
      }),
    ).toBeNull();
    await database.update(contactCodes).set({ consumedAt: clock.now });
    expect(await take()).toBeNull();
  });
});
