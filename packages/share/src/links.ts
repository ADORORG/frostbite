import type { SharePlatform } from "./config.ts";

export interface ShareContent {
  readonly hashtags: readonly string[];
  readonly text: string;
  readonly url: string;
}

// How many characters a link costs where it is counted at a fixed length (the long-link shortener of the large microblogs). A platform that
// counts the link by its real length is given a limit that already includes it.
export const countedLinkLength = 23;

// The words cut to fit, with the link and the hashtags that go with them kept whole, and a mark where the cut is.
export function fitText(
  content: ShareContent,
  maxTextLength: number | undefined,
): string {
  const tags = content.hashtags.map((tag) => `#${tag}`).join(" ");
  if (maxTextLength === undefined)
    return tags === "" ? content.text : `${content.text} ${tags}`;
  const room =
    maxTextLength - countedLinkLength - (tags === "" ? 0 : tags.length + 1) - 1;
  const words =
    content.text.length <= room
      ? content.text
      : `${content.text.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  return tags === "" ? words : `${words} ${tags}`;
}

// The address that opens the destination with this post ready to send. Everything put into the template is percent-encoded, so words
// with `&`, `#` or a line break cannot add a field or end the address.
export function platformLink(
  platform: SharePlatform,
  content: ShareContent,
): string {
  const text = fitText(content, platform.maxTextLength);
  return platform.template
    .replaceAll("{textAndUrl}", encodeURIComponent(`${text} ${content.url}`))
    .replaceAll("{text}", encodeURIComponent(text))
    .replaceAll("{url}", encodeURIComponent(content.url));
}
