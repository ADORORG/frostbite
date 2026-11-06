import { z } from "zod";

import { httpMethodSchema } from "@frostbite/shared/http";
import { capabilitySchema } from "@frostbite/shared/accounts";

const featureIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+$/;
const decisionGateIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const featureCapabilitySchema = z.enum([
  "api-routes",
  "navigation",
  "public-page",
  "authenticated-page",
  "home-section",
  "scheduled-workflows",
  "studio-page",
]);

export const providerCapabilitySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/);

export const decisionGateIdSchema = z.string().regex(decisionGateIdPattern);

export const routeContributionSchema = z
  .object({
    method: httpMethodSchema,
    operationId: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    path: z
      .string()
      .regex(
        /^\/api\/v1\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
      ),
  })
  .strict()
  .readonly();

export const pageAccessRequirementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("public") }).strict(),
  z.object({ kind: z.literal("authenticated") }).strict(),
  z
    .object({
      capability: capabilitySchema,
      kind: z.literal("platform"),
    })
    .strict(),
]);

export const pageContributionSchema = z
  .object({
    access: pageAccessRequirementSchema,
    path: z
      .string()
      .regex(
        /^\/$|^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[[a-z][A-Za-z0-9]*\])(?:\/(?:[a-z0-9]+(?:-[a-z0-9]+)*|\[[a-z][A-Za-z0-9]*\]))*$/,
      ),
  })
  .strict()
  .refine(({ path }) => {
    const names = [...path.matchAll(/\[([a-z][A-Za-z0-9]*)\]/gu)].map(
      ([, name]) => name,
    );
    return new Set(names).size === names.length;
  }, "Page parameter names must be unique.")
  .readonly();

// Where a link is shown. `main` is the public bar, `studio` and `admin` are work areas (each becomes one
// entry in the bar and a sidebar inside), `account` is the account menu, `footer` is the quiet links.
export const navigationAreaSchema = z.enum([
  "main",
  "studio",
  "admin",
  "account",
  "footer",
]);

// Links in an area are shown in ascending order; a link that gives none sits at this position.
export const defaultNavigationOrder = 50;

export const navigationContributionSchema = z
  .object({
    access: pageAccessRequirementSchema,
    area: navigationAreaSchema,
    href: z
      .string()
      .regex(
        /^\/$|^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
      ),
    label: z.string().trim().min(1).max(32),
    order: z.number().int().min(0).max(99).optional(),
  })
  .strict()
  .readonly();

export const featureIdSchema = z.string().regex(featureIdPattern);
export const providerIdSchema = z.string().regex(featureIdPattern);

export const featureManifestSchema = z
  .object({
    id: featureIdSchema,
    version: z.string().regex(semanticVersionPattern),
    capabilities: z
      .array(featureCapabilitySchema)
      .min(1)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
    dependencies: z.array(featureIdSchema).readonly(),
    navigation: z
      .array(navigationContributionSchema)
      .refine(
        (items) => new Set(items.map(({ href }) => href)).size === items.length,
        "Navigation destinations must be unique within a feature.",
      )
      .readonly(),
    requiredProviderCapabilities: z
      .array(providerCapabilitySchema)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
    requiredDecisionGates: z
      .array(decisionGateIdSchema)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
    pages: z.array(pageContributionSchema).readonly(),
    routes: z.array(routeContributionSchema).readonly(),
  })
  .strict()
  .refine(
    ({ capabilities, navigation }) =>
      navigation.length === 0 || capabilities.includes("navigation"),
    "A feature with navigation contributions must declare navigation capability.",
  )
  .refine(
    ({ navigation, pages }) =>
      navigation.every(({ href }) => pages.some(({ path }) => path === href)),
    "Every navigation destination must be an owned static page.",
  )
  .readonly();

export const providerManifestSchema = z
  .object({
    capabilities: z
      .array(providerCapabilitySchema)
      .min(1)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
    requiredDecisionGates: z
      .array(decisionGateIdSchema)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
    id: providerIdSchema,
    version: z.string().regex(semanticVersionPattern),
  })
  .strict()
  .readonly();

export type FeatureCapability = z.infer<typeof featureCapabilitySchema>;
export type DecisionGateId = z.infer<typeof decisionGateIdSchema>;
export type FeatureId = z.infer<typeof featureIdSchema>;
export type FeatureManifest = z.infer<typeof featureManifestSchema>;
export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type ProviderManifest = z.infer<typeof providerManifestSchema>;
export type PageContribution = z.infer<typeof pageContributionSchema>;
export type PageAccessRequirement = PageContribution["access"];
export type NavigationArea = z.infer<typeof navigationAreaSchema>;
export type NavigationContribution = z.infer<
  typeof navigationContributionSchema
>;
export type RouteContribution = z.infer<typeof routeContributionSchema>;
