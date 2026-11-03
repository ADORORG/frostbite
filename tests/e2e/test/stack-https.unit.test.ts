import { describe, expect, it } from "vitest";

import {
  certificateCommand,
  defaultHttpsBaseURL,
  httpsStackEnvironment,
  localhostCertificate,
  localhostNames,
  probeArguments,
} from "../src/stack-https.ts";
import { resolveStackTls } from "../src/manual-stack.ts";

describe("the localhost certificate", () => {
  it("is made by mkcert for every name localhost answers to, when mkcert is there", () => {
    const { args, command } = certificateCommand("mkcert");
    expect(command).toBe("mkcert");
    expect(args).toEqual([
      "-cert-file",
      localhostCertificate.cert,
      "-key-file",
      localhostCertificate.key,
      ...localhostNames,
    ]);
  });

  it("is made by openssl otherwise, self-signed, with a name and an address list the browser accepts", () => {
    const { args, command } = certificateCommand("openssl");
    expect(command).toBe("openssl");
    expect(args).toContain("-x509");
    expect(args[args.indexOf("-addext") + 1]).toBe(
      "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1",
    );
    expect(args[args.indexOf("-keyout") + 1]).toBe(localhostCertificate.key);
    expect(args[args.indexOf("-out") + 1]).toBe(localhostCertificate.cert);
  });

  it("is kept under the stack's ignored data folder", () => {
    expect(localhostCertificate.cert.startsWith(".stack-data")).toBe(true);
    expect(localhostCertificate.key.startsWith(".stack-data")).toBe(true);
  });
});

describe("asking whether a certificate tool is installed", () => {
  it("uses each tool's own spelling: openssl has no --version", () => {
    expect(probeArguments.openssl).toEqual(["version"]);
    expect(probeArguments.mkcert).toEqual(["-version"]);
    for (const tool of ["mkcert", "openssl"] as const)
      expect(probeArguments[tool]).not.toContain("--version");
  });
});

describe("the https stack's environment", () => {
  it("serves https://localhost:4174 with the certificate unless told another https address", () => {
    const environment = httpsStackEnvironment({ PATH: "/bin" });
    expect(environment).toMatchObject({
      PATH: "/bin",
      STACK_BASE_URL: defaultHttpsBaseURL,
      STACK_TLS_CERT: localhostCertificate.cert,
      STACK_TLS_KEY: localhostCertificate.key,
    });
    expect(
      httpsStackEnvironment({ STACK_BASE_URL: " https://localhost:5000 " })
        .STACK_BASE_URL,
    ).toBe("https://localhost:5000");
  });

  it("refuses an http address, which a certificate would not make secure", () => {
    expect(() =>
      httpsStackEnvironment({ STACK_BASE_URL: "http://localhost:4174" }),
    ).toThrow("must start with https://");
  });

  it("gives the stack both files, which it requires together", () => {
    expect(resolveStackTls(httpsStackEnvironment({}))).toEqual(
      localhostCertificate,
    );
  });
});
