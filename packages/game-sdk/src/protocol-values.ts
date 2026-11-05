import "./zod-config.ts";
import { z } from "zod";

// The one conversation between a game and the page that hosts it. Versioned, every message validated on both
// sides. A game cannot do anything the platform has not put in this list.
export const gameChannel = "frostbite-game";
export const protocolVersion = 1;

export type JsonValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

// Anything the game saves is plain JSON: what survives being copied between frames and stored as text.
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().refine(Number.isFinite, "Numbers must be finite."),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const errorCodes = [
  "invalid_request",
  "not_ready",
  "permission_denied",
  "rate_limited",
  "too_large",
  "unavailable",
  "unknown_method",
  "unknown_milestone",
] as const;
export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Who the game is told the player is: an opaque id for this game alone. `local` is made in this browser and
// kept here; `account` is made for the signed-in player's account and is the same on every device. It changes
// once, from local to account, when a player signs in, and the game is told (`player.changed`). It is random:
// nothing in it identifies the person, and another game is given a different one.
export const playerIdentitySchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/u),
    kind: z.enum(["local", "account"]),
  })
  .strict();
export type PlayerIdentity = z.infer<typeof playerIdentitySchema>;

export const playerInfoSchema = z
  .object({ signedIn: z.boolean(), walletConnected: z.boolean() })
  .strict();
export type PlayerInfo = z.infer<typeof playerInfoSchema>;

// How a claim was established: `self-reported` (the game said so) or `replay-verified` (the platform replayed a run under
// the game's published rules; it proves the run was legal, not that a person played it). The platform's manifest names
// the same two levels; a test keeps the lists equal.
export const verificationLevels = ["self-reported", "replay-verified"] as const;
export const verificationSchema = z.enum(verificationLevels);
export type VerificationLevel = z.infer<typeof verificationSchema>;

export const milestoneStatusSchema = z
  .object({
    claimPolicy: z.enum(["once", "repeatable"]),
    criteria: z.string(),
    description: z.string(),
    id: z.string(),
    status: z.enum(["locked", "unlocked"]),
    title: z.string(),
    unlockedAt: z.iso.datetime({ offset: true }).nullable(),
    verification: verificationSchema.nullable(),
  })
  .strict();
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

// The wallet a player has connected, as far as a game that declared the `wallet` capability may see it: the
// public address and the network name. Never a key, a signature, a wallet object or a transaction.
export const walletInfoSchema = z
  .object({
    address: z.string().regex(/^[A-Za-z0-9]{14,90}$/u),
    network: z.string().regex(/^[a-z0-9-]{1,32}$/u),
  })
  .strict();
export type WalletInfo = z.infer<typeof walletInfoSchema>;

// Why a game's request to start a claim cannot go ahead right now. A claim needs a signed-in player, a connected wallet, a
// milestone the player earned in a game that declared a rewards contract, and room under the claim limit; the answer says which
// is missing so the game can say so. `not-supported` is a page or platform that cannot take claims for this game at all,
// `unavailable` is a chain that cannot be reached or a claim the contract would refuse, and `wrong-network` is a wallet on
// another chain than the game's.
export const claimUnavailableReasons = [
  "limit-reached",
  "no-wallet",
  "not-claimable",
  "not-earned",
  "not-supported",
  "signed-out",
  "unavailable",
  "wrong-network",
] as const;

// Where a claim stands, as the player and the game are told (never "minted" before the chain's indexed state agrees):
// waiting for the player's wallet to sign, sent and not yet confirmed, confirmed on chain, complete (indexed state agrees),
// failed (rejected or reverted), or lapsed before it was signed.
export const claimStates = [
  "awaiting-signature",
  "pending",
  "claimed",
  "complete",
  "failed",
  "expired",
] as const;
export type ClaimState = (typeof claimStates)[number];

// A message a game may ask the platform to show the player. Plain text, kept short.
export const toastMaxLength = 140;
