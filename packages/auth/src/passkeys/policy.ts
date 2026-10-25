import type { PasskeyPolicy } from "./contracts.ts";

// What both passkey services (linking and signing in) need to be true of the deployment's policy before they will run: the
// relying-party id is the host of the origin the browser reports, the origin is a bare origin and secure (localhost excepted), and the
// lifetimes are sensible. A passkey is bound to the site's domain, so a wrong value here would silently strand every credential.
export function assertValidPasskeyPolicy(
  policy: Pick<
    PasskeyPolicy,
    | "challengeLifetimeMs"
    | "expectedOrigin"
    | "relyingPartyId"
    | "sessionAbsoluteLifetimeMs"
    | "sessionIdleLifetimeMs"
  >,
): void {
  let origin: URL;
  try {
    origin = new URL(policy.expectedOrigin);
  } catch {
    throw new Error("Passkey policy is invalid");
  }
  if (
    policy.challengeLifetimeMs <= 0 ||
    policy.sessionIdleLifetimeMs <= 0 ||
    policy.sessionAbsoluteLifetimeMs < policy.sessionIdleLifetimeMs ||
    origin.origin !== policy.expectedOrigin ||
    origin.hostname !== policy.relyingPartyId ||
    (origin.protocol !== "https:" && origin.hostname !== "localhost")
  )
    throw new Error("Passkey policy is invalid");
}
