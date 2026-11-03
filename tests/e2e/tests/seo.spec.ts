import { expect, test, type APIRequestContext } from "@playwright/test";

// What a crawler or a link preview sees: the server-rendered HTML, with no script run. Pictures are fetched like a platform's
// crawler would, and the private pages are checked for the instruction to stay out of search.
function tagsOf(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const match of html.matchAll(/<meta\s+([^>]*?)\/?>/gu)) {
    const attributes = match[1] ?? "";
    const key = /(?:property|name)="([^"]+)"/u.exec(attributes)?.[1];
    const content = /content="([^"]*)"/u.exec(attributes)?.[1];
    if (key !== undefined && content !== undefined) tags.set(key, content);
  }
  return tags;
}

async function page(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  const html = await response.text();
  return {
    canonical: /<link rel="canonical" href="([^"]+)"/u.exec(html)?.[1],
    html,
    tags: tagsOf(html),
    title: /<title>([^<]*)<\/title>/u.exec(html)?.[1],
  };
}

// An address in a tag is on the public origin; the test reaches the same file on the address it is running against.
async function expectPicture(request: APIRequestContext, address: string) {
  const { pathname } = new URL(address);
  const response = await request.get(pathname);
  expect(response.status(), pathname).toBe(200);
  expect(response.headers()["content-type"], pathname).toBe("image/png");
  expect((await response.body()).byteLength, pathname).toBeLessThan(5_000_000);
}

test("the games page and a game's page carry their own tags and a picture that exists", async ({
  request,
}) => {
  const list = await page(request, "/games");
  expect(list.title).toContain("Games");
  expect(list.tags.get("og:title")).toBe("Games");
  expect(list.tags.get("twitter:card")).toBe("summary_large_image");
  expect(list.tags.get("robots")).toBeUndefined();

  const game = await page(request, "/games/frostbite");
  expect(game.tags.get("og:title")).toBe("FROST·BITE");
  expect(game.tags.get("og:type")).toBe("website");
  expect(game.tags.get("og:site_name")).toBeTruthy();
  expect(game.tags.get("og:description")).toBeTruthy();
  expect(game.tags.get("description")).toBe(game.tags.get("og:description"));
  expect(game.tags.get("og:image:width")).toBe("1200");
  expect(game.tags.get("og:image:height")).toBe("630");
  expect(game.tags.get("og:image:alt")).toBeTruthy();
  const image = game.tags.get("og:image");
  expect(image).toMatch(/^https?:\/\/.+\/games\/frostbite\/share-image$/u);
  expect(game.tags.get("twitter:image")).toBe(image);
  expect(game.canonical).toBe(game.tags.get("og:url"));
  await expectPicture(request, image ?? "");
});

test("the landing page carries the site's own picture", async ({ request }) => {
  const home = await page(request, "/");
  const image = home.tags.get("og:image");
  expect(image).toMatch(/\/share-image$/u);
  await expectPicture(request, image ?? "");
});

test("a game that is not listed has no picture and no preview", async ({
  request,
}) => {
  expect((await request.get("/games/no-such-game/share-image")).status()).toBe(
    404,
  );
  const missing = await request.get("/games/no-such-game");
  const tags = tagsOf(await missing.text());
  expect(tags.get("robots")).toContain("noindex");
  expect(tags.has("og:title")).toBe(false);
  expect(tags.has("og:image")).toBe(false);
});

test("pages behind sign-in, and the sign-in page itself, stay out of search results", async ({
  request,
}) => {
  for (const path of ["/sign-in", "/setup", "/studio", "/admin", "/account"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    // A page behind sign-in sends the visitor away; one that renders says to keep out.
    if (response.status() === 200) {
      const tags = tagsOf(await response.text());
      expect(tags.get("robots"), path).toContain("noindex");
      expect(tags.has("og:title"), path).toBe(false);
    } else {
      expect([302, 303, 307, 308], path).toContain(response.status());
    }
  }
});

test("robots.txt closes the private areas and the sitemap lists public pages only", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  for (const path of ["/studio", "/admin", "/account", "/api/"])
    expect(robots).toContain(`Disallow: ${path}`);
  expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/u);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
    (match) => new URL(match[1] ?? "").pathname,
  );
  expect(paths).toContain("/");
  expect(paths).toContain("/games/frostbite");
  for (const path of paths)
    expect(path, path).not.toMatch(
      /^\/(studio|admin|account|sign-in|setup|api)(\/|$)/u,
    );
});
