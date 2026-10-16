// The opcodes of the two game-reward templates, as numbers the adapter sends. `contracts/templates/abi/*.json` is the source;
// a test compares every entry here with those files, so a drifting number fails a test.
export const gameRewardsOpcodes = {
  claim: 1n,
  defineMilestone: 2n,
  getClaimed: 100n,
  getLimit: 101n,
  getMilestoneArt: 102n,
  getName: 99n,
  getPaused: 103n,
  initialize: 0n,
  pause: 3n,
  resume: 4n,
} as const;

export const collectibleOpcodes = {
  getName: 99n,
  getAttributes: 1002n,
  getContentType: 1001n,
  getData: 1000n,
} as const;
