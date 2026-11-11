import type { ShareVerification } from "@frostbite/shared/games";

// What a link shows, and nothing about who made it: a case of milestones, one milestone with how the account holds it, or a score.
export type SharedThing =
  | { readonly kind: "milestones" }
  | {
      readonly gameId: string;
      readonly kind: "milestone";
      readonly milestoneId: string;
      readonly verification: ShareVerification;
    }
  | {
      readonly gameId: string;
      readonly kind: "score";
      readonly score: number;
      readonly verification: "self-reported";
    };

export interface StoredShare {
  readonly createdAt: Date;
  readonly id: string;
  readonly thing: SharedThing;
  readonly userId: string;
}

export type NewShare = Pick<
  StoredShare,
  "createdAt" | "id" | "thing" | "userId"
>;

// Where shares live. `createOrGet` adds the share unless the player already has a live one for the same thing, and hands back the one
// that stands, so asking twice gives one link, even when two asks arrive together. `get` answers only for a share that has not been
// revoked. `revoke` ends the player's own live share and says whether it did.
export interface GameShareRepository {
  createOrGet(share: NewShare): Promise<StoredShare>;
  get(id: string): Promise<StoredShare | null>;
  revoke(userId: string, id: string, at: Date): Promise<boolean>;
}
