import type { EnvironmentName } from "../env/definitions.ts";

// Environments that serve real users. Plaintext loopback transport is a local-development
// convenience and is never accepted there.
const hostedEnvironments: readonly EnvironmentName[] = [
  "preview",
  "production",
];

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isHostedEnvironment(environment: EnvironmentName): boolean {
  return hostedEnvironments.includes(environment);
}

// https, or plain http addressed to this machine. Callers that also know the runtime environment
// should use `isTransportAllowed`, which additionally refuses plain http in hosted environments.
export function isSecureOrLoopbackUrl(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && loopbackHosts.has(url.hostname)))
  );
}

export function isTransportAllowed(
  value: string,
  environment: EnvironmentName,
): boolean {
  return (
    isSecureOrLoopbackUrl(value) &&
    (URL.parse(value)?.protocol === "https:" ||
      !isHostedEnvironment(environment))
  );
}
