import { z } from "zod";

import { gameIdSchema } from "../games/manifest.ts";
import { profileAvatarIds } from "./avatars.ts";

// A player's profile: a name, a preset picture and whether the public page is shown. The page is opt-in: no profile, or one switched off,
// has no page and no name anywhere. The numbers that bound a name (its length, how often it may change, the words refused) are the
// deployment's policy; the response carries them so the form checks what the server checks.
export const profileNameCeiling = 32;
export const profileNameReasons = [
  "blocked",
  "bad-characters",
  "too-long",
  "too-short",
] as const;
export type ProfileNameReason = (typeof profileNameReasons)[number];

export const profileAvatarSchema = z.enum(profileAvatarIds);
export const profileNameSchema = z.string().min(1).max(profileNameCeiling);

export const profileSchema = z
  .object({
    avatar: profileAvatarSchema,
    // When the name may change again, or null when it may now.
    canChangeNameAt: z.iso.datetime({ offset: true }).nullable(),
    memberSince: z.iso.datetime({ offset: true }),
    name: profileNameSchema,
    visible: z.boolean(),
  })
  .strict();
export type ProfileView = z.infer<typeof profileSchema>;

export const profilePolicySchema = z
  .object({
    changeCooldownDays: z.int().min(0).max(365),
    maxLength: z.int().min(1).max(profileNameCeiling),
    minLength: z.int().min(1).max(profileNameCeiling),
  })
  .strict();
export type ProfilePolicyView = z.infer<typeof profilePolicySchema>;

export const getMyProfileInputSchema = z.object({}).strict();
export type GetMyProfileInput = z.infer<typeof getMyProfileInputSchema>;
export const getMyProfileResponseSchema = z
  .object({ policy: profilePolicySchema, profile: profileSchema.nullable() })
  .strict();
export type GetMyProfileResponse = z.infer<typeof getMyProfileResponseSchema>;
export const getMyProfileRoute = {
  method: "GET",
  operationId: "getMyProfile",
  path: "/api/v1/profile",
} as const;

// Whether a name could be saved now, so the form can say so while the player types. It is a hint: saving checks again.
export const checkProfileNameInputSchema = z
  .object({ name: profileNameSchema })
  .strict();
export type CheckProfileNameInput = z.infer<typeof checkProfileNameInputSchema>;
export const checkProfileNameResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available") }).strict(),
  z.object({ status: z.literal("yours") }).strict(),
  z.object({ status: z.literal("taken") }).strict(),
  z
    .object({
      status: z.literal("locked"),
      until: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      reason: z.enum(profileNameReasons),
      status: z.literal("invalid"),
    })
    .strict(),
]);
export type CheckProfileNameResponse = z.infer<
  typeof checkProfileNameResponseSchema
>;
export const checkProfileNameRoute = {
  method: "GET",
  operationId: "checkProfileName",
  path: "/api/v1/profile/name",
} as const;

export const saveProfileInputSchema = z
  .object({
    avatar: profileAvatarSchema,
    name: profileNameSchema,
    visible: z.boolean(),
  })
  .strict();
export type SaveProfileInput = z.infer<typeof saveProfileInputSchema>;
export const saveProfileRefusals = [
  "name-invalid",
  "name-locked",
  "name-taken",
] as const;
export const saveProfileResponseSchema = z.discriminatedUnion("status", [
  z.object({ profile: profileSchema, status: z.literal("saved") }).strict(),
  z
    .object({
      reason: z.enum(profileNameReasons).nullable(),
      refusal: z.enum(saveProfileRefusals),
      status: z.literal("refused"),
      until: z.iso.datetime({ offset: true }).nullable(),
    })
    .strict(),
]);
export type SaveProfileResponse = z.infer<typeof saveProfileResponseSchema>;
export const saveProfileRoute = {
  method: "POST",
  operationId: "saveProfile",
  path: "/api/v1/profile",
} as const;

export const deleteProfileInputSchema = z.object({}).strict();
export type DeleteProfileInput = z.infer<typeof deleteProfileInputSchema>;
export const deleteProfileResponseSchema = z
  .object({ deleted: z.boolean() })
  .strict();
export type DeleteProfileResponse = z.infer<typeof deleteProfileResponseSchema>;
export const deleteProfileRoute = {
  method: "POST",
  operationId: "deleteProfile",
  path: "/api/v1/profile/delete",
} as const;

// What anyone may see at `/p/<name>`: the name, the picture, when they joined, the best score the platform's own replay reached in each game
// they have played (never one a game reported), and the milestones they have minted. No wallet, email or account id.
export const publicBestSchema = z
  .object({
    achievedAt: z.iso.datetime({ offset: true }),
    gameId: gameIdSchema,
    score: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const publicProfileMintSchema = z
  .object({
    claimId: z.uuid(),
    gameId: gameIdSchema,
    milestoneId: gameIdSchema,
    mintedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const publicProfileSchema = z
  .object({
    avatar: profileAvatarSchema,
    bests: z.array(publicBestSchema).max(200),
    memberSince: z.iso.datetime({ offset: true }),
    mints: z.array(publicProfileMintSchema).max(500),
    name: profileNameSchema,
  })
  .strict();
export type PublicProfileView = z.infer<typeof publicProfileSchema>;
export const getPublicProfileInputSchema = z
  .object({ name: profileNameSchema })
  .strict();
export type GetPublicProfileInput = z.infer<typeof getPublicProfileInputSchema>;
export const getPublicProfileRoute = {
  method: "GET",
  operationId: "getPublicProfile",
  path: "/api/v1/profiles",
} as const;

// The pages: where a player sets theirs up, and the public one. The name is already URL-safe (letters, digits, `_` and `-`).
export const profileSetupPath = "/profile";
// What the account menu calls the link to it.
export const profileNavigationLabel = "My profile";
export const profilePagePath = "/p/[name]";
export const profilePath = (name: string): `/${string}` => `/p/${name}`;
