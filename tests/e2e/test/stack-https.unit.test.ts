import { describe, expect, it } from "vitest";

import {
  certificateCommand,
  defaultHttpsBaseURL,
  httpsStackEnvironment,
  lanAddresses,
  stackCertificate,
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
      stackCertificate.cert,
      "-key-file",
      stackCertificate.key,
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
    expect(args[args.indexOf("-keyout") + 1]).toBe(stackCertificate.key);
    expect(args[args.indexOf("-out") + 1]).toBe(stackCertificate.cert);
  });

  it("is kept under the stack's ignored data folder", () => {
    expect(stackCertificate.cert.startsWith(".stack-data")).toBe(true);
    expect(stackCertificate.key.startsWith(".stack-data")).toBe(true);
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
  it("listens on every interface and serves the first network address with the certificate", () => {
    expect(
      httpsStackEnvironment(["192.168.1.20", "172.17.0.1"], { PATH: "/bin" }),
    ).toMatchObject({
      PATH: "/bin",
      STACK_BASE_URL: "https://192.168.1.20:4174",
      STACK_HOST: "0.0.0.0",
      STACK_TLS_CERT: stackCertificate.cert,
      STACK_TLS_KEY: stackCertificate.key,
    });
  });

  it("serves localhost when the machine has no network address", () => {
    expect(httpsStackEnvironment([], {}).STACK_BASE_URL).toBe(
      defaultHttpsBaseURL,
    );
  });

  it("lets the person pick another https address or host", () => {
    expect(
      httpsStackEnvironment(["10.0.0.5"], {
        STACK_BASE_URL: " https://10.0.0.9:5000 ",
        STACK_HOST: "10.0.0.5",
      }),
    ).toMatchObject({
      STACK_BASE_URL: "https://10.0.0.9:5000",
      STACK_HOST: "10.0.0.5",
    });
  });

  it("refuses an http address, which a certificate would not make secure", () => {
    expect(() =>
      httpsStackEnvironment([], { STACK_BASE_URL: "http://localhost:4174" }),
    ).toThrow("must start with https://");
  });

  it("gives the stack both files, which it requires together", () => {
    expect(resolveStackTls(httpsStackEnvironment([], {}))).toEqual(
      stackCertificate,
    );
  });
});

describe("the certificate's names", () => {
  const entry = (family: string, address: string, internal = false) =>
    ({ address, family, internal }) as never;

  it("lists only the addresses other machines can reach", () => {
    expect(
      lanAddresses({
        docker0: [entry("IPv4", "172.17.0.1")],
        lo: [entry("IPv4", "127.0.0.1", true)],
        wlan0: [
          entry("IPv6", "fe80::1"),
          entry("IPv4", "192.168.1.20"),
          entry("IPv4", "169.254.3.4"),
        ],
        down: undefined,
      }),
    ).toEqual(["172.17.0.1", "192.168.1.20"]);
  });

  it("puts the addresses in the openssl certificate", () => {
    const { args } = certificateCommand("openssl", stackCertificate, [
      ...localhostNames,
      "10.0.0.5",
    ]);
    expect(args[args.indexOf("-addext") + 1]).toBe(
      "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1,IP:10.0.0.5",
    );
  });
});
