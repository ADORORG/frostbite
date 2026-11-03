import { z } from "zod";

export const platformStatusInputSchema = z.object({}).strict();

export const platformStatusRoute = Object.freeze({
  method: "GET",
  operationId: "getPlatformStatus",
  path: "/api/v1/platform",
} as const);

export const platformApiInfo = Object.freeze({
  title: "The Well API",
  version: "1.0.0",
});

export const platformStatusSchema = z
  .object({
    apiVersion: z.literal("v1"),
    registeredFeatures: z.number().int().nonnegative(),
    stage: z.literal("foundation"),
    transactionalActions: z.literal("gated"),
  })
  .strict();

export type PlatformStatusInput = z.infer<typeof platformStatusInputSchema>;
export type PlatformStatus = z.infer<typeof platformStatusSchema>;

// Where each feature's part of the landing page sits, lowest first. One place, so the order of the page is read in one glance and no two
// features pick numbers that collide.
export const homeSectionOrder = Object.freeze({
  collections: 20,
  games: 10,
  launches: 30,
});

// What the site says about itself in a title bar and a link preview. One place, so the landing page and the site-wide defaults
// cannot drift apart.
export const siteTagline = "Play, earn, collect on Bitcoin";
export const siteDescription =
  "A browser arcade on Bitcoin: play games, earn milestones, collect.";
