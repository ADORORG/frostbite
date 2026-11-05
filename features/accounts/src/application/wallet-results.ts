import type {
  WalletChallengeRequest,
  WalletChallengeResponse,
} from "@frostbite/auth";
import { walletAuthUriPath } from "@frostbite/auth";
import type { HttpFailure } from "@frostbite/http/outcome";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import { createUuidV7 } from "@frostbite/shared/identifiers";

import { outcomeFailure } from "./outcomes.ts";
import type { WalletAuthServices } from "./wallet-services.ts";

// How a failed wallet step is told to the caller, from the catalogue. The reasons that say why a wallet cannot be used are given only after
// the wallet's signature verified, so the person asking holds the wallet's key and learns nothing they could not learn by signing in with
// it; they say whether, never whose. Everything else (expired, replayed, wrong signature, a challenge that is not this route's) is one.
export const notVerified = outcomeFailure("wallet-not-verified");
export const badWalletRequest = outcomeFailure("wallet-request-invalid");
export const recentAuthenticationRequired = outcomeFailure(
  "recent-authentication-required",
);

const walletRefusals: Readonly<
  Record<string, Parameters<typeof outcomeFailure>[0] | undefined>
> = {
  "identity-conflict": "wallet-unusable",
  "wallet-held": "wallet-held",
  "wallet-not-on-account": "wallet-not-on-account",
  "wallet-on-another-account": "wallet-on-another-account",
};

export function verificationFailure(code: string): HttpFailure {
  const refusal = walletRefusals[code];
  return refusal === undefined ? notVerified : outcomeFailure(refusal);
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
