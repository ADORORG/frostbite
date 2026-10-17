import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({
  current: {
    address: "",
    connected: false,
    provider: null as string | null,
    signPsbt: vi.fn(async () => "signed"),
  },
}));
const signed = vi.hoisted(() => vi.fn());
vi.mock("../src/client/provider.tsx", () => ({
  useWalletConnection: () => connection.current,
}));
vi.mock("../src/bridge/step-signer.ts", () => ({ signWithWallet: signed }));

import { useStepWallet, type StepWallet } from "../src/client/step-signer.ts";

let seen: StepWallet | null = null;
function Probe({ allowed }: { readonly allowed: readonly string[] }) {
  seen = useStepWallet(allowed);
  return null;
}
const look = (allowed: readonly string[]) => {
  renderToStaticMarkup(<Probe allowed={allowed} />);
  if (seen === null) throw new Error("not rendered");
  return seen;
};
const connect = (provider: string | null, connected = true) => {
  connection.current = {
    ...connection.current,
    address: connected ? "tb1qstaff" : "tb1qstale",
    connected,
    provider,
  };
};

beforeEach(() => {
  connect(null, false);
  signed.mockReset();
});

describe("the connected wallet as a signer of platform transactions", () => {
  it("signs for a connected wallet of an allowed kind, and offers its address", async () => {
    connect("xverse");
    const wallet = look(["xverse", "unisat", "oyl"]);
    expect(wallet.address).toBe("tb1qstaff");
    signed.mockResolvedValue("done");
    const asked = { chain: "c", family: "f", format: "x", payload: "p" };
    expect(await wallet.sign?.(asked)).toBe("done");
    expect(signed).toHaveBeenCalledWith(connection.current, asked);
  });

  it("does not sign for a wallet that is not on the list, though it is connected", () => {
    connect("leather");
    const wallet = look(["xverse", "unisat", "oyl"]);
    expect(wallet.sign).toBeUndefined();
    expect(wallet.address).toBe("tb1qstaff");
  });

  it("does not sign, and offers no address, while nothing is connected", () => {
    connect("xverse", false);
    expect(look(["xverse"])).toMatchObject({ address: "", sign: undefined });
    connect(null);
    expect(look(["xverse"]).sign).toBeUndefined();
  });
});
