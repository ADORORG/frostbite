import type {
  createSessionService,
  createWalletAuthService,
  createWalletMethodsService,
} from "@frostbite/auth";

// What the wallet operations need, as one value, so they are built from it and tested with stand-ins.
export interface WalletAuthServices {
  readonly auth: ReturnType<typeof createWalletAuthService>;
  readonly methods: ReturnType<typeof createWalletMethodsService>;
  // The platform's own origin: what every signed message names as the place that asked for it.
  readonly origin: string;
  readonly passkeys: {
    list(
      userId: Parameters<
        ReturnType<typeof createWalletMethodsService>["list"]
      >[0],
    ): Promise<readonly string[]>;
  };
  readonly recentAuthenticationWindowMs: number;
  readonly sessions: ReturnType<typeof createSessionService>;
}
