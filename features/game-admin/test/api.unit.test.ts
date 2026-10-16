import type { FetchLike } from "@ador/client-http";
import { gameAdminRoutes } from "@ador/shared/games";
import { describe, expect, it, vi } from "vitest";

import { createGameAdminApi } from "../src/client/api.ts";
import { step, stepId } from "./support/fake-api.ts";

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
const asked = (fetchImpl: ReturnType<typeof vi.fn>) =>
  fetchImpl.mock.calls.map(([path, init]) => [
    path,
    JSON.parse(String((init as { body: string }).body)) as object,
  ]);

describe("the administration routes as the page reaches them", () => {
  it("lists a game's steps, validating what comes back", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => json({ steps: [step()] }));
    const result = await createGameAdminApi(fetchImpl).list("arcade");
    expect(result.steps).toHaveLength(1);
    expect(asked(fetchImpl)).toEqual([
      [gameAdminRoutes.list.path, { gameId: "arcade" }],
    ]);
  });

  it("starts a step, sends it signed, and looks at it, each on its own route with its own body", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (path) =>
      json(
        path === gameAdminRoutes.start.path
          ? { resumed: false, status: "started", step: step() }
          : path === gameAdminRoutes.submit.path
            ? { status: "submitted", step: step() }
            : { status: "ok", step: step() },
      ),
    );
    const api = createGameAdminApi(fetchImpl);
    const action = { operation: "set-claims-paused", paused: true } as const;
    await api.start({ action, gameId: "arcade", wallet: "w" });
    const signed = {
      chain: "simnet:one",
      family: "simulated",
      format: "f",
      payload: "p",
    };
    await api.submit({ signed, stepId });
    await api.refresh(stepId);
    expect(asked(fetchImpl)).toEqual([
      [gameAdminRoutes.start.path, { action, gameId: "arcade", wallet: "w" }],
      [gameAdminRoutes.submit.path, { signed, stepId }],
      [gameAdminRoutes.refresh.path, { stepId }],
    ]);
  });

  it("refuses an answer that is not in the documented shape", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      json({ steps: [{ id: "x" }] }),
    );
    await expect(
      createGameAdminApi(fetchImpl).list("arcade"),
    ).rejects.toThrow();
  });
});
