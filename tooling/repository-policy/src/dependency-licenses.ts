import { z } from "zod";

// The licences the platform's production dependencies may carry, as a record: a change is a new version. Everything here lets the platform
// use, ship and sell what it builds from a package without publishing the platform's own source; a licence not listed fails the check until
// someone reads it and either adds it here or accepts one package under `exceptions`, with the reason.
export const dependencyLicensePolicy = {
  allowed: [
    "0BSD",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "BlueOak-1.0.0",
    "CC0-1.0",
    "ISC",
    "MIT",
    "MIT-0",
    "Unlicense",
  ],
  // One package, under one licence, accepted on purpose. It stops covering the package when its licence changes, so a new version that
  // relicenses is looked at again instead of passing under an old reason.
  exceptions: [
    {
      license: "LGPL-3.0-or-later",
      package: "@img/sharp-libvips-linux-x64",
      reason:
        "sharp's prebuilt libvips, loaded as a separate shared library and never modified: the LGPL permits that if the notice is kept (NOTICE) and the library stays replaceable.",
    },
    {
      license: "LGPL-3.0-or-later",
      package: "@img/sharp-libvips-linuxmusl-x64",
      reason: "The same libvips build for musl; see the glibc one.",
    },
    {
      license: "CC-BY-1.0",
      package: "@cmdcode/buff-utils",
      reason:
        "Attribution only (NOTICE). Used by the tapscript reader that builds the drawing envelope.",
    },
    {
      license: "CC-BY-1.0",
      package: "@cmdcode/crypto-utils",
      reason: "Attribution only (NOTICE); see buff-utils.",
    },
    {
      license: "CC-BY-1.0",
      package: "@cmdcode/tapscript",
      reason: "Attribution only (NOTICE); see buff-utils.",
    },
    {
      license: "CC-BY-3.0",
      package: "spdx-exceptions",
      reason:
        "A list of licence names, used at build time; attribution only (NOTICE).",
    },
    {
      license: "CC-BY-4.0",
      package: "caniuse-lite",
      reason:
        "Browser support data used at build time; attribution only (NOTICE).",
    },
    {
      license: "MPL-2.0",
      package: "lightningcss",
      reason:
        "File-level copyleft on lightningcss's own files, which are used unmodified at build time.",
    },
    {
      license: "MPL-2.0",
      package: "lightningcss-linux-x64-gnu",
      reason: "The same build tool, native part; see lightningcss.",
    },
    {
      license: "MPL-2.0",
      package: "lightningcss-linux-x64-musl",
      reason: "The same build tool, native part; see lightningcss.",
    },
    {
      license: "Unknown",
      package: "@sats-connect/ui",
      reason:
        "Third-party (Secret Key Labs, the Xverse wallet library). The npm package omits its licence field and file, but it is published from github.com/secretkeylabs/sats-connect-ui, which is MIT; credited in NOTICE. Ask the publisher to add the licence to the package.",
    },
    {
      license: "Unknown",
      package: "@sats-connect/make-default-provider-config",
      reason:
        "Third-party, the same publisher as @sats-connect/ui. Built from github.com/secretkeylabs/sats-connect, which is MIT; the npm package omits its licence field and file. Credited in NOTICE.",
    },
  ],
  version: 1,
} as const;

// What `pnpm licenses list --json` answers: each licence, with the packages that carry it.
export const licenseReportSchema = z.record(
  z.string(),
  z.array(z.object({ name: z.string(), versions: z.array(z.string()) })),
);
export type LicenseReport = z.infer<typeof licenseReportSchema>;

type Policy = {
  readonly allowed: readonly string[];
  readonly exceptions: ReadonlyArray<{
    readonly license: string;
    readonly package: string;
  }>;
};

// Whether an SPDX expression is allowed. Only the flat shapes the registry uses are understood: "A", "(A AND B)" (every part allowed) and
// "(A OR B)" (any one allowed). Anything else (a nested expression, a name with a space) leaves a part that is no allowed id, so it is not allowed and a person reads it.
export function expressionAllowed(
  expression: string,
  allowed: readonly string[],
): boolean {
  const flat = expression.trim().replace(/^\((.*)\)$/u, "$1");
  const ok = (id: string) => allowed.includes(id.trim());
  if (flat.includes(" OR ") && !flat.includes(" AND "))
    return flat.split(" OR ").some(ok);
  if (flat.includes(" AND ") && !flat.includes(" OR "))
    return flat.split(" AND ").every(ok);
  return !flat.includes(" ") && ok(flat);
}

// Every package under a licence the policy does not allow and has not accepted as an exception, as a line saying which and under what.
export function findDependencyLicenseViolations(
  report: LicenseReport,
  policy: Policy = dependencyLicensePolicy,
): readonly string[] {
  const accepted = new Set(
    policy.exceptions.map(
      ({ license, package: name }) => `${license}\u0000${name}`,
    ),
  );
  return Object.entries(report)
    .filter(([license]) => !expressionAllowed(license, policy.allowed))
    .flatMap(([license, packages]) =>
      packages
        .filter(({ name }) => !accepted.has(`${license}\u0000${name}`))
        .map(
          ({ name, versions }) =>
            `${name}@${versions.join(",")} is under ${license}, which the policy does not allow.`,
        ),
    );
}
