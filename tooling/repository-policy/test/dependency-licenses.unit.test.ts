import { describe, expect, it } from "vitest";

import {
  dependencyLicensePolicy,
  expressionAllowed,
  findDependencyLicenseViolations,
  licenseReportSchema,
} from "../src/dependency-licenses.ts";

const allowed = ["MIT", "ISC", "Apache-2.0", "BSD-3-Clause"];
const policy = {
  allowed,
  exceptions: [{ license: "LGPL-3.0-or-later", package: "libvips" }],
};
const report = (licenses: Record<string, string[]>) =>
  licenseReportSchema.parse(
    Object.fromEntries(
      Object.entries(licenses).map(([license, names]) => [
        license,
        names.map((name) => ({ name, versions: ["1.0.0"] })),
      ]),
    ),
  );

describe("which licence expressions are allowed", () => {
  it("allows a single allowed licence and refuses one that is not listed", () => {
    expect(expressionAllowed("MIT", allowed)).toBe(true);
    expect(expressionAllowed("GPL-3.0-only", allowed)).toBe(false);
    expect(expressionAllowed("Unknown", allowed)).toBe(false);
  });

  it("allows an AND only when every part is allowed, and an OR when any one is", () => {
    expect(expressionAllowed("(MIT AND BSD-3-Clause)", allowed)).toBe(true);
    expect(expressionAllowed("(MIT AND GPL-3.0-only)", allowed)).toBe(false);
    expect(expressionAllowed("(GPL-3.0-only OR MIT)", allowed)).toBe(true);
    expect(expressionAllowed("(GPL-3.0-only OR AGPL-3.0-only)", allowed)).toBe(
      false,
    );
  });

  it("leaves what it cannot read to a person, and does not accept a name that merely contains an allowed one", () => {
    expect(expressionAllowed("(MIT AND (ISC OR GPL-3.0-only))", allowed)).toBe(
      false,
    );
    expect(expressionAllowed("(MIT AND ISC OR Apache-2.0)", allowed)).toBe(
      false,
    );
    expect(expressionAllowed("MIT-extended", allowed)).toBe(false);
    expect(expressionAllowed("MIT ISC", allowed)).toBe(false);
  });
});

describe("the licences of the production dependencies", () => {
  it("passes when every package is under an allowed licence", () => {
    expect(
      findDependencyLicenseViolations(
        report({ ISC: ["a"], MIT: ["b", "c"] }),
        policy,
      ),
    ).toEqual([]);
  });

  it("names each package under a licence that is not allowed, with the version and the licence", () => {
    expect(
      findDependencyLicenseViolations(
        report({ MIT: ["fine"], "AGPL-3.0-only": ["copyleft"] }),
        policy,
      ),
    ).toEqual([
      "copyleft@1.0.0 is under AGPL-3.0-only, which the policy does not allow.",
    ]);
  });

  it("accepts a package under the licence it was excepted for, and not under another or another package under that one", () => {
    expect(
      findDependencyLicenseViolations(
        report({ "LGPL-3.0-or-later": ["libvips"] }),
        policy,
      ),
    ).toEqual([]);
    expect(
      findDependencyLicenseViolations(
        report({ "GPL-3.0-only": ["libvips"] }),
        policy,
      ),
    ).toHaveLength(1);
    expect(
      findDependencyLicenseViolations(
        report({ "LGPL-3.0-or-later": ["other"] }),
        policy,
      ),
    ).toHaveLength(1);
  });

  it("refuses a report that is not the shape pnpm gives", () => {
    expect(() => licenseReportSchema.parse({ MIT: [{ name: 1 }] })).toThrow();
    expect(() => licenseReportSchema.parse([])).toThrow();
  });
});

describe("the policy itself", () => {
  it("excepts each package once, and says why, and never excepts a licence that is already allowed", () => {
    const keys = dependencyLicensePolicy.exceptions.map(
      ({ license, package: name }) => `${license}/${name}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    for (const { license, reason } of dependencyLicensePolicy.exceptions) {
      expect(reason.length).toBeGreaterThan(20);
      expect(expressionAllowed(license, dependencyLicensePolicy.allowed)).toBe(
        false,
      );
    }
  });

  it("allows no copyleft licence", () => {
    expect(
      dependencyLicensePolicy.allowed.filter((id) =>
        /GPL|AGPL|SSPL|EUPL/u.test(id),
      ),
    ).toEqual([]);
  });
});
