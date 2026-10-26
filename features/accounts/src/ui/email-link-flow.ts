import {
  emailAddressesResponseSchema,
  emailCodeRequestResponseSchema,
  emailCodeRoutes,
  emailLinkedResponseSchema,
} from "@ador/auth";
import type { Requester } from "@ador/client-http";

import { failedFrom, type Failed } from "../client/outcome.ts";

// What happened when a signed-in person changed their email addresses: it worked, or why not, from the catalogue of outcomes.
export type RequestLinkOutcome = { readonly kind: "sent" } | Failed;
export type ConfirmLinkOutcome = { readonly kind: "linked" } | Failed;
export type RemoveOutcome = { readonly kind: "removed" } | Failed;

export async function listEmailAddresses(
  request: Requester,
): Promise<readonly string[]> {
  return (
    await request(emailCodeRoutes.addresses, emailAddressesResponseSchema)
  ).addresses;
}

export async function requestLinkCode(
  request: Requester,
  email: string,
): Promise<RequestLinkOutcome> {
  try {
    await request(emailCodeRoutes.linkRequest, emailCodeRequestResponseSchema, {
      body: { email },
    });
    return { kind: "sent" };
  } catch (error) {
    return failedFrom(error);
  }
}

export async function confirmLinkCode(
  request: Requester,
  email: string,
  code: string,
): Promise<ConfirmLinkOutcome> {
  try {
    await request(emailCodeRoutes.linkVerify, emailLinkedResponseSchema, {
      body: { code, email },
    });
    return { kind: "linked" };
  } catch (error) {
    return failedFrom(error);
  }
}

export async function removeEmailAddress(
  request: Requester,
  email: string,
): Promise<RemoveOutcome> {
  try {
    await request(emailCodeRoutes.unlink, emailLinkedResponseSchema, {
      body: { email },
    });
    return { kind: "removed" };
  } catch (error) {
    return failedFrom(error);
  }
}
