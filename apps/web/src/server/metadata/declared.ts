import { privatePage, type PageMetadata } from "@ador/plugin-kit/page-metadata";
import type { ResolvedFeaturePage } from "@ador/plugin-kit";

// What a resolved page declares about itself. Only a public page can be shared: one behind sign-in is private whatever it declares,
// because a preview or a search result would show it to someone who is not allowed to see it. A page with nothing declared, and an
// address that resolved to no page, are private as well.
export async function declaredMetadata(
  match: ResolvedFeaturePage | undefined,
): Promise<PageMetadata> {
  if (match === undefined || match.page.access.kind !== "public")
    return privatePage;
  return (await match.page.metadata?.({ params: match.params })) ?? privatePage;
}
