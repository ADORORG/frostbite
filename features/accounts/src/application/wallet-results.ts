import type {
  WalletChallengeRequest,
  WalletChallengeResponse,
} from "@ador/auth";
import { walletAuthUriPath } from "@ador/auth";
import { failure, type HttpFailure } from "@ador/http/outcome";
import type { UuidV7 } from "@ador/shared/identifiers";
import { createUuidV7 } from "@ador/shared/identifiers";

import type { WalletAuthServices } from "./wallet-services.ts";

// How a failed wallet step is told to the caller: as few ways as possible, so nothing says whose a conflicting
// wallet is, whether a challenge ever existed, or which check failed.
export const notVerified: HttpFailure = failure(
  "unauthorized",
  "The wallet could not be verified. Request a fresh challenge.",
);
export const cannotUseWallet: HttpFailure = failure(
  "conflict",
  "This wallet cannot be used for that.",
);
export const badWalletRequest: HttpFailure = failure(
  "invalid_request",
  "The wallet request is not valid.",
);
export const recentAuthenticationRequired: HttpFailure = failure(
  "forbidden",
  "Recent authentication is required.",
);

// A verification failure as the caller is told it: a conflict (a wallet that belongs elsewhere, or is held) is its
// own answer; everything else (expired, replayed, wrong signature, a challenge that is not this route's) is one.
export function verificationFailure(code: string): HttpFailure {
  return code === "identity-conflict" ? cannotUseWallet : notVerified;
}

// Asks the wallet service for a challenge for one action. The origin and the address of the page named in the
// message come from the platform's own configuration, never from the request.
export async function issueChallenge(
  services: WalletAuthServices,
  input: WalletChallengeRequest,
  action: "link-wallet" | "sign-in" | "step-up",
  expectedUserId?: UuidV7,
): Promise<
  | { readonly ok: true; readonly value: WalletChallengeResponse }
  | { readonly ok: false; readonly failure: HttpFailure }
> {
  const issued = await services.auth.issue({
    action,
    address: input.address,
    expectedUserId,
    network: input.network,
    origin: services.origin,
    requestId: createUuidV7(),
    uri: new URL(walletAuthUriPath, services.origin).href,
    walletAdapter: input.walletAdapter,
  });
  return issued === null
    ? { failure: badWalletRequest, ok: false }
    : {
        ok: true,
        value: {
          challengeId: issued.challengeId,
          expiresAt: issued.expiresAt.toISOString(),
          message: issued.message,
          signatureScheme: issued.signatureScheme,
        },
      };
}
