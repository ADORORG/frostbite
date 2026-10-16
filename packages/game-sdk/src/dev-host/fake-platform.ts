import type {
  ClaimState,
  EventData,
  EventName,
  PlayerIdentity,
  Result,
  WalletInfo,
} from "../protocol.ts";

// The platform as a builder's local test page plays it: a wallet that can be connected and moved between networks, a player
// who can be signed in or out, and claims that go through their states one press at a time. All of it is made up here and
// says so on the page: nothing is sent anywhere, and the platform's own rules (what a claim needs, what it costs, whether a
// run replays) are not these. It exists so a game can be seen answering each case before it is submitted for review.

export const devNetworks = ["signet", "mainnet"] as const;
export type DevNetwork = (typeof devNetworks)[number];

// Plain addresses that satisfy the protocol's shape, one per network; they are not real.
const addresses: Readonly<Record<DevNetwork, string>> = {
  mainnet: "bc1qdevhostmainnetaddress0000000",
  signet: "tb1qdevhostsignetaddress000000000",
};

export interface DevClaim {
  readonly milestoneId: string;
  readonly state: ClaimState;
}

export interface FakePlatformOptions {
  // Tells the game something (the host drops what the game may not have, or cannot have yet).
  readonly emit: <Name extends EventName>(
    name: Name,
    data: EventData<Name>,
  ) => void;
  // Whether the game has earned the milestone, as its own saved records say.
  readonly earned: (milestoneId: string) => Promise<boolean>;
  // The id this browser gives the player until they sign in.
  readonly localId: () => Promise<string>;
  // Told after anything the page shows changed.
  readonly onChange: () => void;
}

// The next state of a claim when the player presses the button for it; a claim in any other state does not move.
const nextAfter: Partial<Record<ClaimState, ClaimState>> = {
  claimed: "complete",
  pending: "claimed",
};

export function createFakePlatform(options: FakePlatformOptions) {
  const { emit, earned, localId, onChange } = options;
  let network: DevNetwork = "signet";
  let connected = false;
  let signedIn = false;
  const accountId = "dev-account-0001";
  const claims = new Map<string, ClaimState>();

  const walletNow = (): WalletInfo | null =>
    connected ? { address: addresses[network], network } : null;
  const set = (milestoneId: string, state: ClaimState) => {
    claims.set(milestoneId, state);
    emit("claim.changed", { id: milestoneId, state });
    onChange();
  };

  return {
    // The player's claims in the order they were started.
    claims: (): readonly DevClaim[] =>
      [...claims].map(([milestoneId, state]) => ({ milestoneId, state })),

    async claim(milestoneId: string): Promise<Result<"milestones.claim">> {
      if (!signedIn) return { reason: "signed-out", status: "unavailable" };
      if (!connected) return { reason: "no-wallet", status: "unavailable" };
      if (!(await earned(milestoneId)))
        return { reason: "not-earned", status: "unavailable" };
      const held = claims.get(milestoneId);
      // A claim that is over can be started again; one in progress is the same claim.
      if (held === undefined || held === "complete" || held === "failed")
        set(milestoneId, "awaiting-signature");
      return { status: "requested" };
    },

    connect(): void {
      if (connected) return;
      connected = true;
      emit("wallet.changed", { wallet: walletNow() });
      onChange();
    },

    disconnect(): void {
      if (!connected) return;
      connected = false;
      emit("wallet.changed", { wallet: null });
      onChange();
    },

    async identity(): Promise<PlayerIdentity> {
      return signedIn
        ? { id: accountId, kind: "account" }
        : { id: await localId(), kind: "local" };
    },

    isConnected: (): boolean => connected,
    isSignedIn: (): boolean => signedIn,
    network: (): DevNetwork => network,

    // Moves a claim along: signing the one waiting for the wallet, or the next step of one sent. Nothing else moves.
    press(milestoneId: string): void {
      const state = claims.get(milestoneId);
      if (state === "awaiting-signature") return set(milestoneId, "pending");
      const next = state === undefined ? undefined : nextAfter[state];
      if (next !== undefined) set(milestoneId, next);
    },

    async setSignedIn(next: boolean): Promise<void> {
      if (signedIn === next) return;
      signedIn = next;
      emit("player.changed", await this.identity());
      onChange();
    },

    setNetwork(next: DevNetwork): void {
      if (network === next) return;
      network = next;
      if (connected) emit("wallet.changed", { wallet: walletNow() });
      onChange();
    },

    wallet: walletNow,
  };
}

export type FakePlatform = ReturnType<typeof createFakePlatform>;
