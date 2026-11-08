import type { GameClaimsService } from "@frostbite/game-claims";
import type { GameSharesService, SharedThing } from "@frostbite/game-shares";
import { unauthenticated } from "@frostbite/http/outcome";
import {
  createShareResponseSchema,
  createShareRoute,
  revokeShareResponseSchema,
  revokeShareRoute,
} from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createCreateShareOperation,
  createGetSharedPictureOperation,
  createRevokeShareOperation,
} from "../src/application/shares-operations.ts";
import { anonymous, context, userId } from "./support/claim-views.ts";

const shareId = "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";
const service = (overrides: Partial<GameSharesService>) => async () => ({
  create: vi.fn(),
  find: vi.fn(),
  get: vi.fn(),
  revoke: vi.fn(),
  ...overrides,
});
const request = {
  gameId: "template-game",
  kind: "score",
  score: 4210,
} as const;

describe("making a share", () => {
  it("is an authenticated POST on its contract route", () => {
    expect(createCreateShareOperation(service({}))).toMatchObject({
      access: { kind: "authenticated" },
      ...createShareRoute,
    });
  });

  it("makes the link for the session's player and answers with its path", async () => {
    const create = vi.fn(async () => ({
      kind: "shared" as const,
      share: {
        createdAt: new Date(),
        id: shareId,
        thing: {
          gameId: "template-game",
          kind: "score" as const,
          score: 4210,
          verification: "self-reported" as const,
        },
        userId,
      },
    }));
    const answer = await createCreateShareOperation(
      service({ create }),
    ).execute(request, context);
    expect(create).toHaveBeenCalledExactlyOnceWith(userId, request);
    expect(answer).toEqual({
      ok: true,
      value: { id: shareId, path: `/s/${shareId}`, status: "shared" },
    });
    expect(
      createShareResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
  });

  it.each(["not-earned", "unknown-game", "unknown-milestone"] as const)(
    "says why when it cannot: %s",
    async (kind) => {
      const answer = await createCreateShareOperation(
        service({ create: async () => ({ kind }) }),
      ).execute(request, context);
      expect(answer).toEqual({
        ok: true,
        value: { reason: kind, status: "unavailable" },
      });
    },
  );

  it("refuses a visitor who is not signed in, and asks nothing", async () => {
    const create = vi.fn();
    expect(
      await createCreateShareOperation(service({ create })).execute(
        request,
        anonymous,
      ),
    ).toBe(unauthenticated);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("ending a share", () => {
  it("is an authenticated POST on its contract route", () => {
    expect(createRevokeShareOperation(service({}))).toMatchObject({
      access: { kind: "authenticated" },
      ...revokeShareRoute,
    });
  });

  it("ends the session's own link and says whether it did", async () => {
    const revoke = vi.fn(async () => true);
    const answer = await createRevokeShareOperation(
      service({ revoke }),
    ).execute({ id: shareId }, context);
    expect(revoke).toHaveBeenCalledExactlyOnceWith(userId, shareId);
    expect(answer).toEqual({ ok: true, value: { revoked: true } });
    expect(revokeShareResponseSchema.safeParse({ revoked: true }).success).toBe(
      true,
    );
  });

  it("refuses a visitor who is not signed in", async () => {
    const revoke = vi.fn();
    expect(
      await createRevokeShareOperation(service({ revoke })).execute(
        { id: shareId },
        anonymous,
      ),
    ).toBe(unauthenticated);
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("the picture on a shared page", () => {
  const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
  const mint = {
    claimId,
    gameId: "arcade",
    milestoneId: "first-win",
    mintedAt: "2026-10-17T12:00:00.000Z",
    transactionId: "ab".repeat(32),
  };
  const bytes = new Uint8Array([1, 2, 3]);
  const claims = (
    minted = [mint],
    picture: Awaited<ReturnType<GameClaimsService["picture"]>> = {
      bytes,
      contentType: "image/svg+xml",
      edition: 1,
      ok: true,
    },
  ) => ({
    minted: vi.fn(async () => minted),
    picture: vi.fn(async () => picture),
  });
  type Claims = ReturnType<typeof claims>;
  const over = (thing: SharedThing | null, withClaims: Claims = claims()) =>
    createGetSharedPictureOperation(
      service({
        find: async () => (thing === null ? null : { owner: userId, thing }),
      }),
      async () => withClaims,
    );
  const ask = (operation: ReturnType<typeof over>) =>
    operation.execute({ claimId, id: shareId });

  it("is public, so a pasted link needs no sign-in", () => {
    expect(over(null).access).toEqual({ kind: "public" });
  });

  it("shows a mint of the sharer's on their shelf, and the one milestone a milestone link names", async () => {
    const withClaims = claims();
    expect(await ask(over({ kind: "milestones" }, withClaims))).toEqual({
      ok: true,
      value: { bytes, contentType: "image/svg+xml" },
    });
    expect(withClaims.picture).toHaveBeenCalledWith(userId, claimId);
    expect(
      (
        await ask(
          over({
            gameId: "arcade",
            kind: "milestone",
            milestoneId: "first-win",
            verification: "self-reported",
          }),
        )
      ).ok,
    ).toBe(true);
  });

  it.each([
    ["a link that is ended or never was", null],
    [
      "a milestone link for another milestone",
      {
        gameId: "arcade",
        kind: "milestone" as const,
        milestoneId: "other",
        verification: "self-reported" as const,
      },
    ],
    [
      "a score link, which shows no picture",
      {
        gameId: "arcade",
        kind: "score" as const,
        score: 1,
        verification: "self-reported" as const,
      },
    ],
  ])(
    "is not found for %s, and reads nothing from the chain",
    async (_name, thing) => {
      const withClaims = claims();
      const answer = await ask(over(thing, withClaims));
      expect(answer.ok).toBe(false);
      expect(withClaims.picture).not.toHaveBeenCalled();
    },
  );

  it("is not found for a claim that is not the sharer's mint", async () => {
    const withClaims = claims([]);
    expect((await ask(over({ kind: "milestones" }, withClaims))).ok).toBe(
      false,
    );
    expect(withClaims.picture).not.toHaveBeenCalled();
  });

  it("is not found when the chain has no picture", async () => {
    const withClaims = claims([mint], { code: "no-picture", ok: false });
    expect((await ask(over({ kind: "milestones" }, withClaims))).ok).toBe(
      false,
    );
  });
});
