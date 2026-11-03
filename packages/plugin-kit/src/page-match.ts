// Matching a request path against a page's path template (`/games/[slug]`): the same number of segments, each equal or a named
// parameter. Generic in the page so this file knows nothing of what a page is.
export function matchPage<Page extends { readonly path: string }>(
  page: Page,
  path: string,
):
  | { readonly page: Page; readonly params: Readonly<Record<string, string>> }
  | undefined {
  const templateSegments = page.path.split("/");
  const pathSegments = path.split("/");
  if (templateSegments.length !== pathSegments.length) return undefined;
  const params: Record<string, string> = {};
  for (let index = 0; index < templateSegments.length; index += 1) {
    const template = templateSegments[index];
    const value = pathSegments[index];
    if (template === value) continue;
    if (!template || !value) return undefined;
    if (template.startsWith("[") && template.endsWith("]")) {
      params[template.slice(1, -1)] = value;
      continue;
    }
    return undefined;
  }
  return { page, params: Object.freeze(params) };
}

// Pages with fewer parameters are tried first, so a fixed address wins over a template that would also match it.
export function dynamicSegmentCount(path: string): number {
  return path.split("/").filter((segment) => segment.startsWith("[")).length;
}
