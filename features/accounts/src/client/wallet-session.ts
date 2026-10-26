import {
  authMethodsResponseSchema,
  walletAuthRoutes,
  walletChallengeResponseSchema,
  walletChangedResponseSchema,
  walletEmptyRequestSchema,
  walletSignedInResponseSchema,
  type AuthMethodsResponse,
} from "@ador/auth";
import { ApiError, type Parser, type Requester } from "@ador/client-http";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { walletConflictMessages } from "../wallet-conflicts.ts";

// What this module needs to know about the player's connected wallet: a narrow slice of the connection library's
// state, so the sign-in logic does not depend on a vendor and is tested without one.
export interface WalletConnection {
  readonly address: string;
  readonly connected: boolean;
  readonly network: WalletNetwork;
  readonly provider: string | null;
  signMessage(message: string): Promise<string>;
}

export const disconnected: WalletConnection = {
  address: "",
  connected: false,
  network: "signet",
  provider: null,
  signMessage: async () => {
    throw new Error("No wallet is connected.");
  },
};

type Step = "link" | "refresh" | "sign-in" | "sign-out" | "step-up" | "unlink";

// Why the last action did not work, in the player's terms. None of these says whose a wallet is.
export type Failure =
  | "network"
  | "not-connected"
  | "not-verified"
  | "recent-authentication-required"
  | "refused-by-wallet"
  | "unavailable-wallet"
  | "wallet-held"
  | "wallet-on-another-account"
  | "wallet-changed";

type Account =
  | { readonly kind: "signed-in"; readonly methods: AuthMethodsResponse }
  | { readonly kind: "signed-out" }
  | { readonly kind: "unknown" };

// What the screen shows, and only what is true: "signed in" only after the server said so, and a wallet that is
// connected but not linked to the signed-in account is said to be that.
export type WalletSessionView =
  | { readonly kind: "checking" }
  | { readonly kind: "disconnected"; readonly signedIn: boolean }
  | { readonly kind: "connected-signed-out" }
  | { readonly kind: "not-linked" }
  | { readonly kind: "linked" };

export interface WalletSessionSnapshot {
  readonly busy: Step | null;
  readonly failure: Failure | null;
  readonly methods: AuthMethodsResponse | null;
  readonly view: WalletSessionView;
}

function failureOf(error: unknown): Failure {
  if (error instanceof ApiError) {
    if (error.code === "conflict") {
      if (error.message === walletConflictMessages.otherAccount)
        return "wallet-on-another-account";
      return error.message === walletConflictMessages.held
        ? "wallet-held"
        : "unavailable-wallet";
    }
    if (error.code === "forbidden") return "recent-authentication-required";
    if (error.code === "network") return "network";
    return "not-verified";
  }
  return "refused-by-wallet";
}

// The player's wallet session as a small store: who is signed in, which wallet is connected, and the five things a
// player does about it (sign in, link another wallet, sign again, remove a wallet, sign out). One action runs at a
// time. A signature is discarded if the wallet changed while it was being made.
export function createWalletSession(dependencies: {
  readonly request: Requester;
}) {
  const { request } = dependencies;
  let connection: WalletConnection = disconnected;
  let account: Account = { kind: "unknown" };
  let busy: Step | null = null;
  let failure: Failure | null = null;
  let snapshot: WalletSessionSnapshot | null = null;
  const listeners = new Set<() => void>();

  function view(): WalletSessionView {
    if (account.kind === "unknown") return { kind: "checking" };
    if (!connection.connected)
      return { kind: "disconnected", signedIn: account.kind === "signed-in" };
    if (account.kind === "signed-out") return { kind: "connected-signed-out" };
    return account.methods.wallets.some(
      ({ address }) => address === connection.address,
    )
      ? { kind: "linked" }
      : { kind: "not-linked" };
  }
  function publish() {
    snapshot = null;
    for (const listener of listeners) listener();
  }
  function set(next: { busy?: Step | null; failure?: Failure | null }) {
    if (next.busy !== undefined) busy = next.busy;
    if (next.failure !== undefined) failure = next.failure;
    publish();
  }

  async function refresh(): Promise<void> {
    try {
      account = {
        kind: "signed-in",
        methods: await request(
          walletAuthRoutes.methods,
          authMethodsResponseSchema,
        ),
      };
    } catch (error) {
      // Nobody signed in is an answer, not a failure.
      account =
        error instanceof ApiError && error.code === "unauthorized"
          ? { kind: "signed-out" }
          : account;
      if (!(error instanceof ApiError && error.code === "unauthorized"))
        failure = failureOf(error);
    }
    publish();
  }

  // One run of a step; the rest of the work (asking for a challenge, signing, sending it back) is the same for the
  // three wallet steps, so it is written once.
  async function signed(
    step: Step,
    routes: {
      readonly begin: (typeof walletAuthRoutes)[
        "beginLink" | "beginSignIn" | "beginStepUp"];
      readonly verify: (typeof walletAuthRoutes)[
        "verifyLink" | "verifySignIn" | "verifyStepUp"];
    },
    verifySchema: Parser<object>,
  ): Promise<boolean> {
    if (busy !== null) return false;
    if (!connection.connected) {
      set({ failure: "not-connected" });
      return false;
    }
    const { address, network, provider } = connection;
    set({ busy: step, failure: null });
    try {
      const challenge = await request(
        routes.begin,
        walletChallengeResponseSchema,
        {
          body: {
            address,
            network,
            walletAdapter: provider ?? "unknown",
          },
        },
      );
      const signature = await connection.signMessage(challenge.message);
      // The wallet may have been switched or disconnected while the player was signing: that signature is for
      // another wallet, and is not sent.
      if (
        !connection.connected ||
        connection.address !== address ||
        connection.network !== network
      ) {
        set({ busy: null, failure: "wallet-changed" });
        return false;
      }
      await request(routes.verify, verifySchema, {
        body: { challengeId: challenge.challengeId, signature },
      });
      await refresh();
      set({ busy: null });
      return true;
    } catch (error) {
      set({ busy: null, failure: failureOf(error) });
      return false;
    }
  }

  return {
    link: () =>
      signed(
        "link",
        {
          begin: walletAuthRoutes.beginLink,
          verify: walletAuthRoutes.verifyLink,
        },
        walletChangedResponseSchema,
      ),
    refresh: async () => {
      if (busy !== null) return;
      set({ busy: "refresh" });
      await refresh();
      set({ busy: null });
    },
    setConnection: (next: WalletConnection) => {
      const changed =
        next.address !== connection.address ||
        next.connected !== connection.connected ||
        next.network !== connection.network;
      connection = next;
      if (changed) publish();
    },
    signIn: () =>
      signed(
        "sign-in",
        {
          begin: walletAuthRoutes.beginSignIn,
          verify: walletAuthRoutes.verifySignIn,
        },
        walletSignedInResponseSchema,
      ),
    signOut: async (): Promise<boolean> => {
      if (busy !== null) return false;
      set({ busy: "sign-out", failure: null });
      try {
        await request(walletAuthRoutes.signOut, walletChangedResponseSchema, {
          body: walletEmptyRequestSchema.parse({}),
        });
        account = { kind: "signed-out" };
        set({ busy: null });
        return true;
      } catch (error) {
        set({ busy: null, failure: failureOf(error) });
        return false;
      }
    },
    snapshot: (): WalletSessionSnapshot =>
      (snapshot ??= {
        busy,
        failure,
        methods: account.kind === "signed-in" ? account.methods : null,
        view: view(),
      }),
    stepUp: () =>
      signed(
        "step-up",
        {
          begin: walletAuthRoutes.beginStepUp,
          verify: walletAuthRoutes.verifyStepUp,
        },
        walletChangedResponseSchema,
      ),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    unlink: async (walletId: string): Promise<boolean> => {
      if (busy !== null) return false;
      set({ busy: "unlink", failure: null });
      try {
        await request(walletAuthRoutes.unlink, walletChangedResponseSchema, {
          body: { walletId },
        });
        await refresh();
        set({ busy: null });
        return true;
      } catch (error) {
        set({ busy: null, failure: failureOf(error) });
        return false;
      }
    },
  };
}

export type WalletSession = ReturnType<typeof createWalletSession>;
