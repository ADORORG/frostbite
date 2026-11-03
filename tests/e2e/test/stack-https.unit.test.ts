import { describe, expect, it } from "vitest";

import {
  certificateCommand,
  defaultHttpsBaseURL,
  httpsStackEnvironment,
  lanAddresses,
  lanCertificate,
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

describe("--lan", () => {
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

  it("listens on every interface, at the first address, with the lan certificate", () => {
    const environment = httpsStackEnvironment({}, { addresses: ["10.0.0.5"] });
    expect(environment).toMatchObject({
      STACK_BASE_URL: "https://10.0.0.5:4174",
      STACK_HOST: "0.0.0.0",
      STACK_TLS_CERT: lanCertificate.cert,
      STACK_TLS_KEY: lanCertificate.key,
    });
    expect(
      httpsStackEnvironment(
        { STACK_BASE_URL: "https://10.0.0.9:4174", STACK_HOST: "10.0.0.5" },
        { addresses: ["10.0.0.5"] },
      ),
    ).toMatchObject({
      STACK_BASE_URL: "https://10.0.0.9:4174",
      STACK_HOST: "10.0.0.5",
    });
  });

  it("stops when the machine has no network address", () => {
    expect(() => httpsStackEnvironment({}, { addresses: [] })).toThrow(
      "--lan found no network address",
    );
  });

  it("puts the addresses in the certificate", () => {
    const { args } = certificateCommand("openssl", lanCertificate, [
      ...localhostNames,
      "10.0.0.5",
    ]);
    expect(args[args.indexOf("-addext") + 1]).toBe(
      "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1,IP:10.0.0.5",
    );
  });
});
