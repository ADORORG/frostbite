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
