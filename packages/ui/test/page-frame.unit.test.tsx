import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { productName } from "../src/brand.ts";
import { PageFrame } from "../src/patterns/page-frame.tsx";

const render = () =>
  renderToStaticMarkup(
    <PageFrame
      eyebrow="Elsewhere"
      heading="Things"
      intro="What this page is for."
      navigation={[
        { area: "main", href: "/collections", label: "Collections" },
      ]}
    >
      <p>The page itself</p>
    </PageFrame>,
  );

describe("page frame", () => {
  it("opens one raised section with the eyebrow, the heading and the intro, then the page", () => {
    const markup = render();
    const section =
      /<section class="arcade-section arcade-section--raised">(.*?)<\/section>/su.exec(
        markup,
      )?.[1];
    expect(section).toBe(
      '<p class="arcade-eyebrow">Elsewhere</p><h1>Things</h1><p>What this page is for.</p><p>The page itself</p>',
    );
  });

  it("sits in the platform shell, with the platform's name in the footer and the navigation given, and no strip of notices above the header", () => {
    const markup = render();
    expect(markup).toContain(
      `<footer class="app-footer"><span>${productName}</span>`,
    );
    expect(markup).not.toContain("arcade-marquee");
    expect(markup).toContain('href="/collections"');
    expect(markup).toContain("Skip to main content");
  });
});
