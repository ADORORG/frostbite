import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  certificateCommand,
  httpsStackEnvironment,
  localhostCertificate,
  probeArguments,
  type CertificateTool,
} from "../src/stack-https.ts";

// The local stack over HTTPS on localhost: makes a certificate once (a trusted one with mkcert if it is installed, else a self-signed one
// with openssl), then starts the stack with it. Extra arguments (`--fresh`, `--yes`) go on to the stack.
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const environment = httpsStackEnvironment();

const hasTool = (name: CertificateTool) =>
  spawnSync(name, [...probeArguments[name]], { stdio: "ignore" }).status === 0;

if (
  !existsSync(resolve(repositoryRoot, localhostCertificate.cert)) ||
  !existsSync(resolve(repositoryRoot, localhostCertificate.key))
) {
  const tool: CertificateTool = hasTool("mkcert") ? "mkcert" : "openssl";
  if (tool === "openssl" && !hasTool("openssl")) {
    console.error(
      "Neither mkcert nor openssl is installed, so no certificate can be made. Install one of them and run this again.",
    );
    process.exit(1);
  }
  mkdirSync(resolve(repositoryRoot, ".stack-data"), { recursive: true });
  const { args, command } = certificateCommand(tool);
  const made = spawnSync(command, args, {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (made.status !== 0) {
    console.error(`${command} could not make the certificate.`);
    process.exit(made.status ?? 1);
  }
  console.log(
    tool === "mkcert"
      ? "Made a certificate with mkcert. If the browser does not trust it yet, run `mkcert -install` once."
      : "Made a self-signed certificate. The browser warns about it once: accept it (or install mkcert for a trusted one, then delete .stack-data/localhost-*.pem).",
  );
}

const child = spawn(
  process.execPath,
  [
    "--experimental-strip-types",
    resolve(import.meta.dirname, "manual-stack.ts"),
    ...process.argv.slice(2),
  ],
  { env: environment, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
