// How long a share picture may be reused. A site-wide picture changes only with a release; a page's own picture follows its page, so a
// changed title or cover reaches the platforms' caches within a day and a shared cache may serve a stale one while it refreshes.
export const defaultImageCacheControl =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";
export const pageImageCacheControl =
  "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400";
