import { z } from "zod";

declare const chainRefBrand: unique symbol;
declare const chainFamilyIdBrand: unique symbol;

export type ChainRef = string & { readonly [chainRefBrand]: true };
export type ChainFamilyId = string & { readonly [chainFamilyIdBrand]: true };

// CAIP-2 (https://chainagnostic.org/CAIPs/caip-2): `namespace:reference`. The namespace is 3 to 8
// characters of [-a-z0-9]; the reference is 1 to 32 characters of [-_a-zA-Z0-9]. The platform never
// hard-codes the values that identify its own networks; they come from validated configuration.
const chainRefPattern = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/u;
const chainFamilyIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

// The brand is introduced only after the pattern check, the same way `uuidV7Schema` does it.
export const chainRefSchema = z
  .string()
  .regex(chainRefPattern, "Expected a CAIP-2 chain reference")
  .transform((value) => value as ChainRef);

export const chainFamilyIdSchema = z
  .string()
  .max(48)
  .regex(chainFamilyIdPattern, "Expected a lowercase chain family id")
  .transform((value) => value as ChainFamilyId);

export function chainNamespace(chain: ChainRef): string {
  return chain.slice(0, chain.indexOf(":"));
}

// The part of a CAIP-2 reference after the namespace.
export function chainReference(chain: ChainRef): string {
  return chain.slice(chain.indexOf(":") + 1);
}

// A capability an adapter declares or a feature requires, for example `address:codec` or
// `allowlist-proof:merkle`. Names are lowercase words joined by `-` and grouped with `:`.
export const chainCapabilitySchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)+$/u,
    "Expected a capability name",
  );
