import { ApiError, type Requester } from "@frostbite/client-http";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { vi } from "vitest";

import type { WalletConnection } from "../../src/client/wallet-session.ts";

export const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
export const walletId = createUuidV7();
export const challengeId = createUuidV7();
export const wallet = (
  over: Partial<WalletConnection> = {},
): WalletConnection => ({
  address,
  connected: true,
  network: "signet",
  provider: "xverse",
  signMessage: vi.fn(async () => "the-signature"),
  ...over,
});
export const methods = (addresses: string[] = [address]) => ({
  passkeys: [],
  recentAuthentication: true,
  wallets: addresses.map((a, at) => ({
    address: a,
    id: at === 0 ? walletId : createUuidV7(),
    linkedAt: "2026-10-13T12:00:00.000Z",
    network: "signet" as const,
    walletAdapter: "xverse",
  })),
});
export type Handler = (body: object | undefined) => unknown;

// A server that answers by route, from what the test gives it; anything it was not given is a test bug.
export function server(handlers: Record<string, Handler>) {
  const calls: { body: object | undefined; path: string }[] = [];
  const request = (async (
    route: { path: string },
    schema: { safeParse(v: unknown): { success: boolean; data?: unknown } },
    options?: { body?: object },
  ) => {
    calls.push({ body: options?.body, path: route.path });
    const handler = handlers[route.path];
    if (handler === undefined)
      throw new Error(`Unexpected request to ${route.path}`);
    const answer = handler(options?.body);
    if (answer instanceof ApiError) throw answer;
    const parsed = schema.safeParse(answer);
    if (!parsed.success)
      throw new Error(
        `The test answered ${route.path} with a shape the contract refuses`,
      );
    return parsed.data;
  }) as Requester;
  return { calls, request };
}
export const challenge = () => ({
  challengeId,
  expiresAt: "2026-10-13T12:05:00.000Z",
  message: "sign this",
  signatureScheme: "bip322-simple",
});
export const signedOutServer = (extra: Record<string, Handler> = {}) =>
  server({
    "/api/v1/auth/methods": () => new ApiError("unauthorized", 401, "no"),
    ...extra,
  });
export const err = (
  code: ConstructorParameters<typeof ApiError>[0],
  status: number | null = 400,
  reason: string | null = null,
) => new ApiError(code, status, "x", null, reason);
