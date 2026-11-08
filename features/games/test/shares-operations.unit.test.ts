import type { GameSharesService } from "@frostbite/game-shares";
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
  createRevokeShareOperation,
} from "../src/application/shares-operations.ts";
import { anonymous, context, userId } from "./support/claim-views.ts";

const shareId = "0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a";
const service = (overrides: Partial<GameSharesService>) => async () => ({
  create: vi.fn(),
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
