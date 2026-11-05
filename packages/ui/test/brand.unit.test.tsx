import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { productName } from "../src/brand.ts";
import { BrandMark } from "../src/components/brand-mark.tsx";

describe("the platform's mark", () => {
  it("is a nine by nine pixel snowflake with a bright core, hidden from assistive technology", () => {
    const markup = renderToStaticMarkup(<BrandMark />);
    expect(markup).toContain('viewBox="0 0 9 9"');
    expect(markup).toContain('aria-hidden="true"');
    // 22 arm pixels and 7 bright ones (the middle of the cross).
    expect(markup.match(/<rect/gu)).toHaveLength(29);
    expect(markup.match(/brand-mark__core/gu)).toHaveLength(7);
    expect(markup.match(/brand-mark__arm/gu)).toHaveLength(22);
  });

  it("is called Frostbite: the one name the shell, the page title and the favicon take", () => {
    expect(productName).toBe("Frostbite");
  });

  // The shell takes its name from `productName` and an email from NEXT_PUBLIC_APP_NAME, so a template that spells it differently shows
  // two names for one platform. Every committed template is read, those of the apps too.
  it("is the name every environment template gives the platform, optionally followed by a label for a preview or a test", async () => {
    const root = join(import.meta.dirname, "../../..");
    const folders = [
      root,
      ...(await readdir(join(root, "apps"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => join(root, "apps", name)),
    ];
    const templates: string[] = [];
    for (const folder of folders)
      for (const name of await readdir(folder))
        if (/^\.env.*\.example$/u.test(name))
          templates.push(join(folder, name));
    // Found, not assumed: the root template and an app's own.
    expect(templates).toContain(join(root, ".env.example"));
    expect(templates).toContain(join(root, "apps/web/.env.example"));
    for (const template of templates) {
      const text = await readFile(template, "utf8");
      const name = /^NEXT_PUBLIC_APP_NAME=(.*)$/mu.exec(text)?.[1];
      expect(
        name === productName || name?.startsWith(`${productName} `),
        `${template} names the platform "${name ?? "nothing"}", not "${productName}"`,
      ).toBe(true);
    }
  });
});
