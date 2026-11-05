import type { ChainRef } from "@frostbite/shared/chain";
import { and, eq } from "drizzle-orm";

import type { DatabaseClient } from "../connection/client.ts";
import { gameContracts, publishedTemplates } from "../schema/game-contracts.ts";

// A template published on a chain: where it is, and the hash of the code that was published there.
export interface PublishedTemplate {
  readonly address: string;
  readonly codeHash: string;
  readonly publishedAt: Date;
  // `id@version`.
  readonly templateRef: string;
}

// A game's rewards contract on a chain: where it is, the family of chain it is on, and the largest drawing it accepts.
export interface StoredGameContract {
  readonly address: string;
  readonly family: string;
  readonly maxDrawingBytes: number;
}

// What a completed step adds to the platform's record of the chain, written in the same moment as the step is completed so the
// two cannot disagree.
export type Recording =
  | {
      readonly address: string;
      readonly codeHash: string;
      readonly kind: "template";
      readonly templateRef: string;
    }
  | {
      readonly address: string;
      readonly family: string;
      readonly gameId: string;
      readonly kind: "game";
      readonly maxDrawingBytes: number;
    };

// Where the platform learns what is on the chain: the templates it published and the contract of each game, both recorded when the
// step that made them completed. Nothing here is configuration, so adding a game adds a row and nothing else.
export interface ContractStore {
  // Whether the chain's address is already recorded as a template or a game's contract.
  addressTaken(chain: ChainRef, address: string): Promise<boolean>;
  gameContract(
    gameId: string,
    chain: ChainRef,
  ): Promise<StoredGameContract | null>;
  publishedTemplate(
    chain: ChainRef,
    templateRef: string,
  ): Promise<PublishedTemplate | null>;
  publishedTemplates(chain: ChainRef): Promise<readonly PublishedTemplate[]>;
}

// What is on the chain, as the platform recorded it when the steps that put it there completed.
export function createDrizzleContractStore(
  database: DatabaseClient,
): ContractStore {
  return {
    addressTaken: async (chain, address) => {
      const [template] = await database
        .select({ address: publishedTemplates.address })
        .from(publishedTemplates)
        .where(
          and(
            eq(publishedTemplates.chain, chain),
            eq(publishedTemplates.address, address),
          ),
        );
      if (template !== undefined) return true;
      const [game] = await database
        .select({ address: gameContracts.address })
        .from(gameContracts)
        .where(
          and(
            eq(gameContracts.chain, chain),
            eq(gameContracts.address, address),
          ),
        );
      return game !== undefined;
    },
    gameContract: async (gameId, chain) => {
      const [row] = await database
        .select({
          address: gameContracts.address,
          family: gameContracts.family,
          maxDrawingBytes: gameContracts.maxDrawingBytes,
        })
        .from(gameContracts)
        .where(
          and(eq(gameContracts.gameId, gameId), eq(gameContracts.chain, chain)),
        );
      return row ?? null;
    },
    publishedTemplate: async (chain, templateRef) => {
      const [row] = await database
        .select()
        .from(publishedTemplates)
        .where(
          and(
            eq(publishedTemplates.chain, chain),
            eq(publishedTemplates.templateRef, templateRef),
          ),
        );
      return row ?? null;
    },
    publishedTemplates: (chain) =>
      database
        .select()
        .from(publishedTemplates)
        .where(eq(publishedTemplates.chain, chain))
        .orderBy(publishedTemplates.publishedAt),
  };
}

// What writing a recording needs of the database: the transaction that completes the step passes itself.
export type RecordingTransaction = Pick<DatabaseClient, "insert">;

// Writes a recording, inside the database transaction that completes the step that made it.
export async function writeRecording(
  transaction: RecordingTransaction,
  step: { readonly chain: string; readonly id: string },
  recording: Recording,
): Promise<void> {
  if (recording.kind === "template") {
    await transaction.insert(publishedTemplates).values({
      address: recording.address,
      chain: step.chain,
      codeHash: recording.codeHash,
      stepId: step.id,
      templateRef: recording.templateRef,
    });
    return;
  }
  await transaction.insert(gameContracts).values({
    address: recording.address,
    chain: step.chain,
    family: recording.family,
    gameId: recording.gameId,
    maxDrawingBytes: recording.maxDrawingBytes,
    stepId: step.id,
  });
}
