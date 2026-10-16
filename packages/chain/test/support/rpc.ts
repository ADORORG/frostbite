import type { JsonValue } from "@ador/shared/chain";

import type { JsonRpc } from "../../src/bitcoin-alkanes/node/transport.ts";

export interface RpcCall {
  readonly method: string;
  readonly params: readonly JsonValue[];
}

// A JSON-RPC peer that answers each method from a table and remembers what it was asked.
export function scriptedRpc(answers: Readonly<Record<string, JsonValue>>) {
  const calls: RpcCall[] = [];
  const rpc: JsonRpc = {
    call: (method, params) => {
      calls.push({ method, params });
      const answer = answers[method];
      return answer === undefined
        ? Promise.reject(new Error(`unexpected ${method}`))
        : Promise.resolve(answer);
    },
  };
  return { calls, rpc };
}
