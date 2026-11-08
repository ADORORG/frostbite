import type { GameClaimsService, PublicMints } from "@frostbite/game-claims";
import {
  encodeGalleryCursor,
  getGalleryPictureFileSchema,
  listGalleryMintsResponseSchema,
} from "@frostbite/shared/games";
import { describe, expect, it, vi } from "vitest";

import {
  createGetGalleryPictureOperation,
  createListGalleryMintsOperation,
} from "../src/application/gallery-operations.ts";

const listed = new Set(["arcade"]);
const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const mint = {
  claimId,
  milestoneId: "first-win",
  mintedAt: new Date("2026-10-17T12:00:00.000Z"),
  transactionId: "ab".repeat(32),
  verification: "replay-verified" as const,
  wallet: "tb1pj0psqzcu3nf6jhk6k083xpjvqgd3rqy38q8kjqcw203xc0zgfmmsmhkvgx",
};
const gallery = (over: Partial<PublicMints> = {}): PublicMints => ({
  counts: vi.fn(async () => new Map([["first-win", 3]])),
  owner: vi.fn(async () => ({
    gameId: "arcade",
    milestoneId: "first-win",
    userId: "u1",
  })),
  page: vi.fn(async () => ({ mints: [mint], next: null })),
  ...over,
});

describe("the public list of a game's mints", () => {
  it("is public, answers in the contract's shape, and shortens the wallet so the whole address never leaves", async () => {
    const operation = createListGalleryMintsOperation(
      async () => gallery(),
      listed,
    );
    expect(operation.access).toEqual({ kind: "public" });
    const answer = await operation.execute({ gameId: "arcade" });
    expect(answer).toMatchObject({
      ok: true,
      value: {
        counts: [{ count: 3, milestoneId: "first-win" }],
        mints: [
          {
            claimId,
            mintedAt: "2026-10-17T12:00:00.000Z",
            verification: "replay-verified",
            wallet: expect.stringContaining("…"),
          },
        ],
        next: null,
      },
    });
    expect(
      listGalleryMintsResponseSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
    expect(JSON.stringify(answer)).not.toContain(mint.wallet);
  });

  it("asks for the counts with the first page only, and hands a cursor back as the place to start", async () => {
    const source = gallery();
    const operation = createListGalleryMintsOperation(
      async () => source,
      listed,
    );
    const cursor = encodeGalleryCursor({
      claimId,
      completedAt: new Date("2026-10-16T00:00:00.000Z"),
    });
    const answer = await operation.execute({ cursor, gameId: "arcade" });
    expect(answer).toMatchObject({ ok: true, value: { counts: null } });
    expect(source.counts).not.toHaveBeenCalled();
    expect(source.page).toHaveBeenCalledWith("arcade", 24, {
      claimId,
      completedAt: new Date("2026-10-16T00:00:00.000Z"),
    });
  });

  it("gives the cursor of the next page when there is one", async () => {
    const next = { claimId, completedAt: new Date("2026-10-15T00:00:00.000Z") };
    const operation = createListGalleryMintsOperation(
      async () =>
        gallery({ page: vi.fn(async () => ({ mints: [mint], next })) }),
      listed,
    );
    expect(await operation.execute({ gameId: "arcade" })).toMatchObject({
      value: { next: encodeGalleryCursor(next) },
    });
  });

  it("is not found for a game the platform does not list, and reads nothing", async () => {
    const source = gallery();
    const operation = createListGalleryMintsOperation(
      async () => source,
      listed,
    );
    expect((await operation.execute({ gameId: "other" })).ok).toBe(false);
    expect(source.page).not.toHaveBeenCalled();
  });
});

describe("the picture of a mint in the gallery", () => {
  const claims = (ok = true) =>
    ({
      picture: vi.fn(async () =>
        ok
          ? {
              bytes: new Uint8Array([1]),
              contentType: "image/svg+xml" as const,
              edition: 1,
              ok: true as const,
            }
          : { code: "no-picture" as const, ok: false as const },
      ),
    }) as unknown as Pick<GameClaimsService, "picture">;

  it("is public, and reads the picture as the player the completed claim belongs to", async () => {
    const reading = claims();
    const operation = createGetGalleryPictureOperation(
      async () => gallery(),
      async () => reading,
      listed,
    );
    expect(operation.access).toEqual({ kind: "public" });
    const answer = await operation.execute({ claimId });
    expect(answer).toEqual({
      ok: true,
      value: { bytes: new Uint8Array([1]), contentType: "image/svg+xml" },
    });
    expect(
      getGalleryPictureFileSchema.safeParse(answer.ok ? answer.value : null)
        .success,
    ).toBe(true);
    expect(reading.picture).toHaveBeenCalledWith("u1", claimId);
  });

  it.each([
    [
      "a claim that is not complete or does not exist",
      { owner: vi.fn(async () => null) },
    ],
    [
      "a claim of a game that is not listed",
      {
        owner: vi.fn(async () => ({
          gameId: "gone",
          milestoneId: "m",
          userId: "u1",
        })),
      },
    ],
  ])(
    "is not found for %s, and reads nothing from the chain",
    async (_name, over) => {
      const reading = claims();
      const operation = createGetGalleryPictureOperation(
        async () => gallery(over),
        async () => reading,
        listed,
      );
      expect((await operation.execute({ claimId })).ok).toBe(false);
      expect(reading.picture).not.toHaveBeenCalled();
    },
  );

  it("is not found when the chain has no picture", async () => {
    const operation = createGetGalleryPictureOperation(
      async () => gallery(),
      async () => claims(false),
      listed,
    );
    expect((await operation.execute({ claimId })).ok).toBe(false);
  });
});
