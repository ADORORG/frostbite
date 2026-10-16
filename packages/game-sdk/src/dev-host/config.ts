import "../zod-config.ts";
import { z } from "zod";

import type { HostedGame } from "../host-types.ts";

// What the local test page needs to know about a game, and what a builder writes (as `game.json`, or the CLI is given): the same
// parts of the manifest the platform's host reads, nothing more. A milestone's fields are the manifest's own.
const milestoneSchema = z
  .object({
    claimPolicy: z.enum(["once", "repeatable"]),
    criteria: z.string(),
    description: z.string(),
    id: z.string().min(1).max(64),
    maxCount: z.number().int().positive().optional(),
    target: z.number().int().positive().optional(),
    title: z.string(),
  })
  .strict();

export const devGameSchema = z
  .object({
    capabilities: z.array(z.string()).default([]),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    milestones: z.array(milestoneSchema).default([]),
  })
  .strict();

export type DevGame = z.infer<typeof devGameSchema>;

// The page's start-up answer: the game, and the address of its built files.
export const devConfigSchema = z
  .object({ game: devGameSchema, src: z.string().min(1) })
  .strict();
export type DevConfig = z.infer<typeof devConfigSchema>;

// A parsed game is what the host takes.
export const hostedGameOf = (game: DevGame): HostedGame => ({
  capabilities: game.capabilities,
  id: game.id,
  milestones: game.milestones,
});
