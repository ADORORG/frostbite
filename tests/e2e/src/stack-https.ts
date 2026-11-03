import type { networkInterfaces } from "node:os";
import { join } from "node:path";

// `pnpm stack:https`: the local stack served over HTTPS on localhost, so a page is a secure context (the web app needs `crypto.subtle`, and
// the `Secure` session cookie is kept). This module is the plain data and text; `scripts/stack-https.ts` runs the commands.

// Where the certificate and key are kept, relative to the repository root (the stack reads `STACK_TLS_*` from there). Beside the database
// and storage, in a folder git ignores.
export const localhostCertificate = {
  cert: join(".stack-data", "localhost-cert.pem"),
  key: join(".stack-data", "localhost-key.pem"),
} as const;

// The same, for `--lan`: made again at every start, since the machine's addresses change from one network to the next.
export const lanCertificate = {
  cert: join(".stack-data", "lan-cert.pem"),
  key: join(".stack-data", "lan-key.pem"),
} as const;

// The IPv4 addresses other machines on the network can reach this one by (not loopback, not the link-local 169.254 range).
export function lanAddresses(
  interfaces: ReturnType<typeof networkInterfaces>,
): string[] {
  return Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter(
      (entry) =>
        entry.family === "IPv4" &&
        !entry.internal &&
        !entry.address.startsWith("169.254."),
    )
    .map((entry) => entry.address);
}

// The names and addresses the certificate is good for.
export const localhostNames = ["localhost", "127.0.0.1", "::1"] as const;

export const defaultHttpsBaseURL = "https://localhost:4174";

export type CertificateTool = "mkcert" | "openssl";

// The way to ask a tool whether it is installed: each answers its own spelling (`openssl version`, `mkcert -version`), and `--version` is
// a mistake for the first.
export const probeArguments: Readonly<
  Record<CertificateTool, readonly string[]>
> = { mkcert: ["-version"], openssl: ["version"] };

export interface Command {
  readonly args: readonly string[];
  readonly command: string;
}

// How to make the certificate. `mkcert` makes one a browser trusts (after its one-time `mkcert -install`); without it, `openssl` makes a
// self-signed one, which a browser warns about once.
export function certificateCommand(
  tool: CertificateTool,
  files: { readonly cert: string; readonly key: string } = localhostCertificate,
  names: readonly string[] = localhostNames,
): Command {
  if (tool === "mkcert")
    return {
      args: ["-cert-file", files.cert, "-key-file", files.key, ...names],
      command: "mkcert",
    };
  const alternatives = names
    .map((name) =>
      name.includes(":") || /^\d/u.test(name) ? `IP:${name}` : `DNS:${name}`,
    )
    .join(",");
  return {
    args: [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "365",
      "-subj",
      "/CN=localhost",
      "-addext",
      `subjectAltName=${alternatives}`,
      "-keyout",
      files.key,
      "-out",
      files.cert,
    ],
    command: "openssl",
  };
}

// The environment the stack starts with. A `STACK_BASE_URL` the person set wins only if it is HTTPS: an http address with a certificate
// would be a mistake worth stopping for.
export function httpsStackEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  lan: { readonly addresses: readonly string[] } | null = null,
): NodeJS.ProcessEnv {
  const configured = environment.STACK_BASE_URL?.trim() ?? "";
  if (configured !== "" && !configured.startsWith("https://"))
    throw new Error(
      `STACK_BASE_URL is ${configured}; pnpm stack:https serves HTTPS, so it must start with https:// (or be left unset for ${defaultHttpsBaseURL}).`,
    );
  if (lan === null)
    return {
      ...environment,
      STACK_BASE_URL: configured === "" ? defaultHttpsBaseURL : configured,
      STACK_TLS_CERT: localhostCertificate.cert,
      STACK_TLS_KEY: localhostCertificate.key,
    };
  const [first] = lan.addresses;
  if (first === undefined)
    throw new Error(
      "--lan found no network address on this machine. Connect to a network, or leave --lan out for localhost.",
    );
  return {
    ...environment,
    STACK_BASE_URL:
      configured === ""
        ? `https://${first}:${new URL(defaultHttpsBaseURL).port}`
        : configured,
    STACK_HOST: environment.STACK_HOST?.trim() || "0.0.0.0",
    STACK_TLS_CERT: lanCertificate.cert,
    STACK_TLS_KEY: lanCertificate.key,
  };
}
