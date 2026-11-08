import { z } from "zod";

// Where a link can be shared. The destinations are configuration, not code: an address template with `{url}` (the page being shared),
// `{text}` (the words to post) and `{textAndUrl}` (both, for a destination that takes one field), each filled in percent-encoded. A
// template must be an https address and must carry the link, or sharing through it would share nothing.
export const sharePlatformSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/u),
    label: z.string().trim().min(1).max(32),
    // The longest the whole post may be for this destination, the link counted as it counts it; none when it takes any length.
    maxTextLength: z.int().min(1).max(10_000).optional(),
    template: z
      .string()
      .url()
      .refine((value) => value.startsWith("https://"), "https only")
      .refine(
        (value) => value.includes("{url}") || value.includes("{textAndUrl}"),
        "the template must carry the link",
      ),
  })
  .strict();
export type SharePlatform = z.infer<typeof sharePlatformSchema>;

export const shareConfigSchema = z
  .object({
    // Words added after the post, without the leading #. A destination that has no use for them ignores them.
    hashtags: z.array(z.string().regex(/^[A-Za-z0-9_]{1,40}$/u)).max(5),
    platforms: z
      .array(sharePlatformSchema)
      .min(1)
      .max(12)
      .refine(
        (list) => new Set(list.map(({ id }) => id)).size === list.length,
        "platform ids must be unique",
      ),
  })
  .strict();
export type ShareConfig = z.infer<typeof shareConfigSchema>;

// Checks a configuration when it is made, so a bad template stops the platform at start instead of failing for a player.
export const defineShareConfig = (config: ShareConfig): ShareConfig =>
  shareConfigSchema.parse(config);
