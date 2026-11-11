import type { ProfilesService, StoredProfile } from "@frostbite/profiles";
import type { HttpOperation } from "@frostbite/http";
import { unauthenticated } from "@frostbite/http/outcome";
import {
  checkProfileNameInputSchema,
  checkProfileNameResponseSchema,
  checkProfileNameRoute,
  deleteProfileInputSchema,
  deleteProfileResponseSchema,
  deleteProfileRoute,
  getMyProfileInputSchema,
  getMyProfileResponseSchema,
  getMyProfileRoute,
  saveProfileInputSchema,
  saveProfileResponseSchema,
  saveProfileRoute,
  type CheckProfileNameInput,
  type CheckProfileNameResponse,
  type DeleteProfileInput,
  type DeleteProfileResponse,
  type GetMyProfileInput,
  type GetMyProfileResponse,
  type ProfileView,
  type SaveProfileInput,
  type SaveProfileResponse,
} from "@frostbite/shared/profiles";

type Service = () => Promise<ProfilesService>;

// A profile as the owner sees it: the name and picture, whether the page is shown, since when, and when the name may change again.
export function viewOf(
  service: ProfilesService,
  profile: StoredProfile,
): ProfileView {
  return {
    avatar: profile.avatar,
    canChangeNameAt: service.unlocksAt(profile)?.toISOString() ?? null,
    memberSince: profile.createdAt.toISOString(),
    name: profile.name,
    visible: profile.visible,
  };
}

// The signed-in player's own profile (none yet is a normal answer) with the rules a name must meet, so the form checks what the server checks.
export function createGetMyProfileOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    cache: { kind: "revalidate" },
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const service = await getService();
      const profile = await service.get(context.actorUserId);
      return {
        ok: true,
        value: {
          policy: {
            changeCooldownDays: service.policy.changeCooldownDays,
            maxLength: service.policy.maxLength,
            minLength: service.policy.minLength,
          },
          profile: profile === null ? null : viewOf(service, profile),
        },
      } as const;
    },
    idempotency: "none",
    input: "query",
    inputSchema: getMyProfileInputSchema,
    outputSchema: getMyProfileResponseSchema,
    ...getMyProfileRoute,
  } satisfies HttpOperation<GetMyProfileInput, GetMyProfileResponse>;
}

// Whether a name could be saved now, for the form to say while the player types. A hint only: saving checks again, and a name that was free a
// moment ago may be gone.
export function createCheckProfileNameOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    cache: { kind: "revalidate" },
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const check = await (
        await getService()
      ).checkName(context.actorUserId, input.name);
      return {
        ok: true,
        value:
          check.status === "locked"
            ? { status: "locked", until: check.until.toISOString() }
            : check,
      } as const;
    },
    idempotency: "none",
    input: "query",
    inputSchema: checkProfileNameInputSchema,
    outputSchema: checkProfileNameResponseSchema,
    ...checkProfileNameRoute,
  } satisfies HttpOperation<CheckProfileNameInput, CheckProfileNameResponse>;
}

// Makes or changes the signed-in player's profile. The owner is the session, never a field of the request.
export function createSaveProfileOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      const service = await getService();
      const result = await service.save(context.actorUserId, input);
      return {
        ok: true,
        value:
          result.status === "saved"
            ? { profile: viewOf(service, result.profile), status: "saved" }
            : {
                reason: result.reason,
                refusal: result.refusal,
                status: "refused",
                until: result.until?.toISOString() ?? null,
              },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: saveProfileInputSchema,
    outputSchema: saveProfileResponseSchema,
    ...saveProfileRoute,
  } satisfies HttpOperation<SaveProfileInput, SaveProfileResponse>;
}

// Takes the signed-in player's profile down and frees the name.
export function createDeleteProfileOperation(getService: Service) {
  return {
    access: { kind: "authenticated" },
    applicationErrors: ["unauthorized"],
    execute: async (_input, context) => {
      if (context.actorUserId === null) return unauthenticated;
      return {
        ok: true,
        value: {
          deleted: await (await getService()).remove(context.actorUserId),
        },
      } as const;
    },
    idempotency: "none",
    input: "json",
    inputSchema: deleteProfileInputSchema,
    outputSchema: deleteProfileResponseSchema,
    ...deleteProfileRoute,
  } satisfies HttpOperation<DeleteProfileInput, DeleteProfileResponse>;
}
