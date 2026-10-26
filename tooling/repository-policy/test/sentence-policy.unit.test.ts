import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  baselineOf,
  findDuplicateSentences,
  readProductionSources,
  sentenceSites,
} from "../src/sentence-policy.ts";

const source = (path: string, text: string) => ({ path, text });
const once = source(
  "features/a/src/one.ts",
  'const a = "You are signed out. Sign in again.";',
);
const again = source(
  "features/b/src/two.ts",
  'const b = "You are signed out. Sign in again.";',
);

describe("where a sentence is written", () => {
  it("finds a capitalised literal of five words or more that ends as a sentence ends, by file and line", () => {
    const sites = sentenceSites([
      source(
        "features/a/src/x.ts",
        'x\nconst a = "This is a whole sentence.";\nconst b = "Is this really a question here?";\nconst c = "Stop right there and wait!";',
      ),
    ]);
    expect([...sites.keys()]).toEqual([
      "This is a whole sentence.",
      "Is this really a question here?",
      "Stop right there and wait!",
    ]);
    expect(sites.get("This is a whole sentence.")).toEqual([
      "features/a/src/x.ts:2",
    ]);
  });

  it("leaves out what is not a sentence: short labels, identifiers, lower case, no end, and code", () => {
    const sites = sentenceSites([
      source(
        "features/a/src/x.ts",
        [
          'const a = "Sign in.";',
          'const b = "Only four words now.";',
          'const c = "lower case start of this sentence.";',
          'const d = "Starts well but never ends";',
          'const e = "A_CONSTANT_NAME_WITH_NO_SPACES_AT_ALL.";',
          "const f = 'Single quoted sentence that is long enough.';",
        ].join("\n"),
      ),
    ]);
    expect(sites.size).toBe(0);
  });

  it("counts a sentence once per place, wherever it is, and treats whitespace as one space", () => {
    const sites = sentenceSites([
      source(
        "features/a/src/x.ts",
        'const a = "Same   sentence,  said twice over.";\nconst b = "Same sentence, said twice over.";',
      ),
    ]);
    expect(sites.get("Same sentence, said twice over.")).toEqual([
      "features/a/src/x.ts:1",
      "features/a/src/x.ts:2",
    ]);
  });
});

describe("the duplicate sentence check", () => {
  it("accepts a sentence written once", () => {
    expect(findDuplicateSentences([once], {})).toEqual([]);
  });

  it("refuses a sentence written in two places, naming both", () => {
    const violations = findDuplicateSentences([once, again], {});
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("features/a/src/one.ts:1");
    expect(violations[0]).toContain("features/b/src/two.ts:1");
    expect(violations[0]).toContain("written 2 times");
  });

  it("allows the duplicates the baseline records, and no more of them", () => {
    const sentence = "You are signed out. Sign in again.";
    expect(findDuplicateSentences([once, again], { [sentence]: 2 })).toEqual(
      [],
    );
    const third = source(
      "features/c/src/three.ts",
      'const c = "You are signed out. Sign in again.";',
    );
    const grown = findDuplicateSentences([once, again, third], {
      [sentence]: 2,
    });
    expect(grown).toHaveLength(1);
    expect(grown[0]).toContain("the baseline allows 2");
  });

  it("refuses a baseline that allows more than there is, so it can only shrink", () => {
    const sentence = "You are signed out. Sign in again.";
    const stale = findDuplicateSentences([once], { [sentence]: 2 });
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain("out of date");
    expect(stale[0]).toContain("now written 1 time(s), not 2");
  });

  it("refuses a baseline entry for a sentence that is gone", () => {
    const violations = findDuplicateSentences([], {
      "A sentence nobody writes now.": 2,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("no longer written anywhere");
  });
});

describe("the baseline that allows exactly today's duplicates", () => {
  it("lists only sentences written more than once, with their counts, in order", () => {
    const other = source(
      "features/d/src/four.ts",
      'const d = "Another sentence of five words.";',
    );
    expect(baselineOf([again, once, other])).toEqual({
      "You are signed out. Sign in again.": 2,
    });
    expect(baselineOf([once])).toEqual({});
  });
});

describe("which files are read", () => {
  const roots: string[] = [];
  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true })),
    );
  });

  it("reads production source of features, packages and the web app, and nothing else", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sentences-"));
    roots.push(root);
    const paths = [
      "features/a/src/x.ts",
      "features/a/src/ui/y.tsx",
      "packages/b/src/z.ts",
      "apps/web/src/app/page.tsx",
      "features/a/test/x.unit.test.ts",
      "packages/b/test/support/s.ts",
      "tooling/t/src/tool.ts",
      "tests/e2e/tests/spec.ts",
      "features/a/src/types.d.ts",
      "features/a/src/styles.css",
    ];
    for (const path of paths) {
      await mkdir(resolve(root, path, ".."), { recursive: true });
      await writeFile(resolve(root, path), "x", "utf8");
    }
    const read = await readProductionSources(
      root,
      paths.map((path) => resolve(root, path)),
    );
    expect(read.map(({ path }) => path)).toEqual([
      "features/a/src/x.ts",
      "features/a/src/ui/y.tsx",
      "packages/b/src/z.ts",
      "apps/web/src/app/page.tsx",
    ]);
  });
});
