import type {
  ErrorCode,
  EventData,
  EventName,
  JsonValue,
  PlayerIdentity,
  PlayerInfo,
  WalletInfo,
} from "./protocol.ts";

// What the host keeps for a player on behalf of a game. The host owns storage and, later, the account; a game
// never sees where this lives.
export interface GameHostBackend {
  // Who the game is told the player is. A backend that reconciles with an account answers once that is done,
  // so a signed-in player is never first shown an id that is about to change.
  identity(): Promise<PlayerIdentity>;
  loadProgress(): Promise<JsonValue | null>;
  // Each milestone the player has earned, with the time, how it is verified, and how many times.
  milestones(): Promise<
    Readonly<
      Record<
        string,
        {
          count: number;
          unlockedAt: string;
          verification: "self-reported";
        }
      >
    >
  >;
  // The totals a game last reported toward a milestone's target, by milestone.
  counters(): Promise<Readonly<Record<string, number>>>;
  // Records a total toward a target: the larger of it and what is held, never above the target. Reaching the
  // target earns the milestone (once), and `unlockedAt` says when.
  reportProgress(
    id: string,
    current: number,
    target: number,
    now: Date,
  ): Promise<{
    current: number;
    newlyUnlocked: boolean;
    unlockedAt: string | null;
  }>;
  player(): PlayerInfo;
  saveProgress(state: JsonValue, now: Date): Promise<void>;
  // Earns a milestone. `max` is how many times it can be counted: 1 for one earned once. A repeat of one
  // already earned is counted while below it (`counted`), and is `alreadyUnlocked` either way.
  unlock(
    id: string,
    now: Date,
    max: number,
  ): Promise<{
    alreadyUnlocked: boolean;
    count: number;
    counted: boolean;
    unlockedAt: string;
  }>;
}

// The parts of a game's manifest the host needs: who it is, what it asked for, and which milestones it
// declared. A game that declares no capabilities is granted none.
export interface HostedGame {
  readonly capabilities?: readonly string[];
  readonly id: string;
  readonly milestones: readonly {
    readonly claimPolicy: "once" | "repeatable";
    readonly criteria: string;
    readonly description: string;
    readonly id: string;
    // The most a repeatable milestone is counted, and the total a milestone earned once needs; see the manifest.
    readonly maxCount?: number;
    readonly target?: number;
    readonly title: string;
  }[];
}

// What the page shows the player as it happens.
export type HostEvent =
  | { readonly type: "ready" }
  | { readonly type: "progress-saved"; readonly savedAt: string }
  | { readonly id: string; readonly type: "milestone-unlocked" }
  | {
      readonly count: number;
      readonly id: string;
      readonly type: "milestone-counted";
    }
  | {
      readonly current: number;
      readonly id: string;
      readonly target: number;
      readonly type: "milestone-progress";
    }
  | {
      readonly code: ErrorCode;
      readonly method: string;
      readonly type: "refused";
    };

// What the page lends a game, beyond the player's saved state. Each is optional: a page that cannot offer it
// says so truthfully (no wallet, nothing shown) rather than pretending.
export interface HostServices {
  // Shows the player a short plain-text message from the game.
  toast?(message: string): void;
  // The wallet the player has connected right now, or none.
  wallet?(): WalletInfo | null;
}

export interface GameHost {
  // Tells the game something happened. Sent only after the game has called `ready`, and, for the wallet, only
  // when the game declared the capability. The data is checked before it leaves.
  emit<Name extends EventName>(name: Name, data: EventData<Name>): void;
  // One message from the game's frame. The caller has already checked it came from that frame.
  handle(data: unknown): Promise<void>;
}
