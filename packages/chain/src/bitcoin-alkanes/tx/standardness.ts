// The largest transaction Bitcoin nodes relay by default, in virtual bytes: Bitcoin Core's `MAX_STANDARD_TX_WEIGHT` of 400,000 weight
// units (policy/policy.h), a quarter of which is 100,000 vB. A bigger one is valid only if a miner takes it directly, so the platform
// never builds one.
export const maxStandardVirtualBytes = 100_000;
