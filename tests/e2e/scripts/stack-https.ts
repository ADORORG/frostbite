import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

import {
  certificateCommand,
  httpsStackEnvironment,
  lanAddresses,
  lanCertificate,
  localhostCertificate,
  localhostNames,
  probeArguments,
  type CertificateTool,
} from "../src/stack-https.ts";

// The local stack over HTTPS on localhost: makes a certificate once (a trusted one with mkcert if it is installed, else a self-signed one
// with openssl), then starts the stack with it. Extra arguments (`--fresh`, `--yes`) go on to the stack.
const repositoryRoot = resolve(import.meta.dirname, "../../..");
// `--lan` opens the stack to the local network: it listens on every interface and the certificate names this machine's addresses.
const lan = process.argv.includes("--lan");
const passedOn = process.argv
  .slice(2)
  .filter((argument) => argument !== "--lan");
const addresses = lanAddresses(networkInterfaces());
const environment = httpsStackEnvironment(
  process.env,
  lan ? { addresses } : null,
);
const files = lan ? lanCertificate : localhostCertificate;
const names = lan ? [...localhostNames, ...addresses] : localhostNames;

const hasTool = (name: CertificateTool) =>
  spawnSync(name, [...probeArguments[name]], { stdio: "ignore" }).status === 0;

if (
  lan ||
  !existsSync(resolve(repositoryRoot, files.cert)) ||
  !existsSync(resolve(repositoryRoot, files.key))
) {
  const tool: CertificateTool = hasTool("mkcert") ? "mkcert" : "openssl";
  if (tool === "openssl" && !hasTool("openssl")) {
    console.error(
      "Neither mkcert nor openssl is installed, so no certificate can be made. Install one of them and run this again.",
    );
    process.exit(1);
  }
  mkdirSync(resolve(repositoryRoot, ".stack-data"), { recursive: true });
  const { args, command } = certificateCommand(tool, files, names);
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

if (lan)
  console.log(
    `Open https://<address>:4174 from another device, one of: ${addresses.join(", ")}. If nothing answers, the firewall is blocking port 4174.`,
  );

const child = spawn(
  process.execPath,
  [
    "--experimental-strip-types",
    resolve(import.meta.dirname, "manual-stack.ts"),
    ...passedOn,
  ],
  { env: environment, stdio: "inherit" },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
