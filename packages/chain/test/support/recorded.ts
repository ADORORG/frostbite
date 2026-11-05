import type { JsonValue } from "@frostbite/shared/chain";

// Responses copied from the public Subfrost mainnet node on 2026-10-16 (read-only calls), so the decoders are checked against
// what the node really sends, not only against what this code expects.

// `metashrew_view simulate` of contract 2:0 (DIESEL), opcode 99 (name): data "DIESEL", 40683 fuel.
export const dieselName = "0x0a081a0644494553454c10ebbd02";

// The same call with an opcode the contract does not have.
export const unrecognisedOpcode =
  "0x1a2b414c4b414e45533a207265766572743a204572726f723a20556e7265636f676e697a6564206f70636f6465";

// A call to a contract that is not deployed.
export const missingContract =
  "0x1a26756e657870656374656420656e642d6f662d66696c6520286174206f66667365742030783029";

// `metashrew_view simulate` request for 2:0 opcode 99 at height 971738, built independently of this code.
export const dieselNameRequest = "0x20daa73b2a03020063";

// The request the Alkanes TypeScript SDK sends for the bytecode of 2:0.
export const bytecodeRequestOfTwoZero = "0x0a060a0208021200";

// Fee estimates from the node (target blocks to satoshis per virtual byte), as it answered.
export const feeEstimates: JsonValue = {
  "1": 1.82,
  "2": 1.82,
  "3": 1.111,
  "6": 0.349,
  "144": 0.214,
  "1008": 0.1,
};

// An unspent output list as Esplora answers it: one confirmed, one still in the mempool.
export const unspentOutputs: JsonValue[] = [
  {
    status: {
      block_hash:
        "00000000000000000000df56b335bea42169c8c08bb75d21418f14ec7abd7a7c",
      block_height: 971601,
      block_time: 1792084933,
      confirmed: true,
    },
    txid: "685680e1dc3b527646eace44a0040485ff4f446f7f3d58de8dda52e6593890c4",
    value: 1212916,
    vout: 57,
  },
  {
    status: { confirmed: false },
    txid: "dbb2944639faca8acc6182ab8d7e28f1c7c9040c602d2fcc144b75093aee30b8",
    value: 1038348,
    vout: 0,
  },
];

// A confirmed transaction (two outputs) and the answer for one the node has never heard of.
export const confirmedTransaction: Record<string, JsonValue> = {
  fee: 147,
  status: {
    block_hash:
      "00000000000000000000ab55cf71a471603e3a20939c700254cf3b0b1a9afbb2",
    block_height: 971742,
    block_time: 1792171682,
    confirmed: true,
  },
  txid: "aa9833a5bc390773b721d36947409d7077ea925034b5962c677fa8bec47f0bc2",
  version: 2,
  vout: [{ value: 546 }, { value: 0 }],
};
export const unknownTransaction = "Transaction not found";

// The trace the node returned for the first call of transaction aa9833a5…0bc2 (output 3): a call that succeeded.
export const mainnetSuccessTrace =
  "0x0a390a37080112330a2c0a060a020802120012040a0012001a02084d1a001a001a001a001a001a001a001a001a001a001a001a00200310e0cfd5010a16121412121a106c0d00000000000000000000000000000a16121412121a106ac2b3120000000000000000000000000aaa0112a70112a0010a0e0a060a0208021200120408d2c30512190a052f666565731210d5a07c961d000000000000000000000012200a0c2f746f74616c737570706c7912108531fc92ad400000000000000000000012300a2b2f74782d6861736865732fc20b7fc4bea87f672c96b5345092ea77709d404769d321b7730739bca53398aa120101121f0a172f75706772616465645f7365656e2fded30e00000000001204010000001892ac17";
