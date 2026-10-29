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

  it("is the same mark whatever the name beside it", () => {
    expect(renderToStaticMarkup(<BrandMark />)).toBe(
      renderToStaticMarkup(<BrandMark />),
    );
    expect(productName).toBe("Frostbit");
  });
});
