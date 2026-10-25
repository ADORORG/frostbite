import {
  authSessions,
  authUsers,
  contactCodes,
  contactIdentities,
} from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  clock,
  database,
  issueInput,
  repository,
  signedInAccount,
  signInInput,
  start,
  useContactWorld,
} from "./support/contact-world.ts";

useContactWorld();

async function issued(overrides: Parameters<typeof issueInput>[0] = {}) {
  const input = issueInput(overrides);
  await repository.issue(input);
  return input;
}

describe("completing a sign-in", () => {
  it("makes the account, the verified address and the session on the first sign-in", async () => {
    const code = await issued();
    const input = signInInput(code.id);
    const result = await repository.completeSignIn(input);
    if (result.kind !== "signed-in") throw new Error("expected a sign-in");
    const [user] = await database
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, result.userId));
    expect(user).toMatchObject({ name: "Email user" });
    expect(user?.email).toBe(`contact-${result.userId}@contact.invalid`);
    const [identity] = await database.select().from(contactIdentities);
    expect(identity).toMatchObject({
      kind: "email",
      userId: result.userId,
      value: "ada@example.com",
    });
    expect(identity?.verifiedAt).toEqual(start);
    const [session] = await database.select().from(authSessions);
    expect(session).toMatchObject({
      tokenHash: input.session.tokenHash,
      userId: result.userId,
    });
    expect(session?.authenticatedAt).toEqual(start);
  });

  it("signs the same account in the second time, adding no account", async () => {
    const first = await issued();
    const one = await repository.completeSignIn(signInInput(first.id));
    clock.now = new Date(start.getTime() + 120_000);
    const second = await issued({ issuedAt: clock.now });
    const two = await repository.completeSignIn(
      signInInput(second.id, { now: clock.now }),
    );
    expect(
      one.kind === "signed-in" &&
        two.kind === "signed-in" &&
        one.userId === two.userId,
    ).toBe(true);
    expect(await database.select().from(authUsers)).toHaveLength(1);
    expect(await database.select().from(contactIdentities)).toHaveLength(1);
    expect(await database.select().from(authSessions)).toHaveLength(2);
  });

  it("gives different addresses different accounts", async () => {
    const ada = await issued();
    const grace = await issued({ destination: "grace@example.com" });
    await repository.completeSignIn(signInInput(ada.id));
    await repository.completeSignIn(
      signInInput(grace.id, { destination: "grace@example.com" }),
    );
    expect(await database.select().from(authUsers)).toHaveLength(2);
  });

  it("spends the code: it signs in once", async () => {
    const code = await issued();
    expect((await repository.completeSignIn(signInInput(code.id))).kind).toBe(
      "signed-in",
    );
    expect(await repository.completeSignIn(signInInput(code.id))).toEqual({
      kind: "conflict",
    });
    expect(await database.select().from(authSessions)).toHaveLength(1);
  });

  it("lets exactly one of several simultaneous attempts with one code sign in", async () => {
    const code = await issued();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        repository.completeSignIn(signInInput(code.id)),
      ),
    );
    expect(results.filter(({ kind }) => kind === "signed-in")).toHaveLength(1);
    expect(await database.select().from(authSessions)).toHaveLength(1);
    expect(await database.select().from(authUsers)).toHaveLength(1);
  });

  it("makes one account when two different live codes complete together for a new address", async () => {
    const first = await issued();
    // A second live code can exist only by writing it past the replacement rule; completion must still make one account.
    const second = issueInput({ destination: "ada@example.com" });
    await database.insert(contactCodes).values({ ...second, consumedAt: null });
    const results = await Promise.all([
      repository.completeSignIn(signInInput(first.id)),
      repository.completeSignIn(signInInput(second.id)),
    ]);
    expect(results.every(({ kind }) => kind === "signed-in")).toBe(true);
    expect(await database.select().from(authUsers)).toHaveLength(1);
    expect(await database.select().from(contactIdentities)).toHaveLength(1);
  });

  it("refuses a code that has expired, a replaced one, and one that does not exist", async () => {
    const expired = await issued();
    const late = new Date(expired.expiresAt.getTime());
    expect(
      await repository.completeSignIn(signInInput(expired.id, { now: late })),
    ).toEqual({ kind: "conflict" });
    const old = await issued({ destination: "grace@example.com" });
    await issued({
      destination: "grace@example.com",
      issuedAt: new Date(start.getTime() + 60_000),
    });
    expect(
      await repository.completeSignIn(
        signInInput(old.id, { destination: "grace@example.com" }),
      ),
    ).toEqual({ kind: "conflict" });
    expect(
      await repository.completeSignIn(
        signInInput("00000000-0000-7000-8000-00000000dead"),
      ),
    ).toEqual({ kind: "conflict" });
    expect(await database.select().from(authUsers)).toHaveLength(0);
  });

  it("refuses a code that was sent for linking, even when asked for by its id", async () => {
    const account = await signedInAccount({ address: "mine@example.com" });
    const code = await issued({ purpose: "link", userId: account.userId });
    expect(await repository.completeSignIn(signInInput(code.id))).toEqual({
      kind: "conflict",
    });
    expect(await database.select().from(authUsers)).toHaveLength(1);
  });
});
