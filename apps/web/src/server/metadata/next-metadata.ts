import type { Metadata } from "next";
import type { PageMetadata } from "@ador/plugin-kit/page-metadata";

import { defaultShareImage, type SiteIdentity } from "./site.ts";
import { siteDescription, siteTagline } from "@ador/shared/platform";

const imageSize = { height: 630, width: 1200 } as const;

// Site-wide defaults every page inherits. `metadataBase` makes each relative address below absolute on the public origin.
export function siteMetadata(site: SiteIdentity): Metadata {
  return {
    applicationName: site.name,
    description: siteDescription,
    metadataBase: new URL(site.origin),
    openGraph: {
      description: siteDescription,
      images: [
        {
          ...imageSize,
          alt: defaultShareImage.alt,
          url: defaultShareImage.path,
        },
      ],
      siteName: site.name,
      title: `${site.name} | ${siteTagline}`,
      type: "website",
    },
    title: {
      default: `${site.name} | ${siteTagline}`,
      template: `%s | ${site.name}`,
    },
    twitter: { card: "summary_large_image" },
  };
}

const keepOut: Metadata["robots"] = { follow: false, index: false };

// The tags for one page. A private page is told to stay out of search results and shows no preview; a shared page names itself,
// says where its canonical address is, and carries the preview a pasted link shows.
export function pageMetadata(
  page: PageMetadata,
  site: SiteIdentity,
  path: string,
): Metadata {
  if (page.kind === "private")
    return {
      openGraph: null,
      robots: keepOut,
      twitter: null,
    };
  const image = page.image ?? defaultShareImage;
  const images = [{ ...imageSize, alt: image.alt, url: image.path }];
  return {
    alternates: { canonical: path },
    description: page.description,
    openGraph: {
      description: page.description,
      images,
      siteName: site.name,
      title: page.title,
      type: "website",
      url: path,
    },
    title: page.title,
    twitter: {
      card: "summary_large_image",
      description: page.description,
      images: images.map(({ alt, url }) => ({ alt, url })),
      title: page.title,
    },
  };
}
