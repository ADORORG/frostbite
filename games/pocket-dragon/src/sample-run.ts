import type { RunRecord } from "@ador/game-sdk/run-record";

import { gameId, verifierId, verifierVersion } from "./rules/constants.ts";

// One legal run the verifier is shown with, in the first chapter (Egg Hills): a player who sees what is coming runs the three stages,
// climbs to each secret charm, fights DeFu's ghost dragons, guards and egg rocket at the end of each stage without being hit, and
// catches the freed eggs. It earns every milestone the chapter can. It is a plain record, not one built with the SDK's recorder, so the
// published verifier carries only the rules and not the recorder's schema library. Each choice is "tick on control": the tick, whether
// the control was pressed (1) or let go of (0), and which control; the run is closed on tick 7622.
const choices = `
0 1 right, 236 1 jump, 248 0 jump, 311 1 jump, 323 0 jump, 496 1 jump, 508 0 jump, 655 1 jump, 667 0 jump, 698 1 jump, 710 0 jump,
753 1 jump, 765 0 jump, 808 1 jump, 820 0 jump, 886 1 fire, 887 0 fire, 1012 1 jump, 1019 0 jump, 1269 1 fire, 1270 0 fire, 1468 1 jump,
1475 0 jump, 1910 1 fire, 1911 0 fire, 1928 1 fire, 1929 0 fire, 1930 0 right, 1950 1 fire, 1951 0 fire, 1968 1 fire, 1969 0 fire,
1972 1 right, 1972 1 jump, 1974 0 right, 1990 1 fire, 1991 0 fire, 2008 1 fire, 2009 0 fire, 2010 1 right, 2012 0 jump, 2014 0 right,
2014 1 jump, 2016 1 left, 2022 0 left, 2022 1 right, 2024 0 jump, 2024 0 right, 2030 1 fire, 2031 0 fire, 2036 1 right, 2048 1 left,
2048 0 right, 2048 1 fire, 2049 0 fire, 2050 0 left, 2050 1 right, 2052 0 right, 2070 1 fire, 2071 0 fire, 2088 1 fire, 2089 0 fire,
2109 1 right, 2505 1 fire, 2506 0 fire, 2637 1 jump, 2679 0 jump, 2877 1 jump, 2889 0 jump, 2990 1 jump, 3002 0 jump, 3024 1 jump,
3036 0 jump, 3082 1 jump, 3094 0 jump, 3137 1 jump, 3149 0 jump, 3273 1 fire, 3274 0 fire, 3411 1 jump, 3423 0 jump, 3475 1 jump,
3487 0 jump, 3574 1 jump, 3586 0 jump, 3679 1 jump, 3691 0 jump, 3810 1 jump, 3817 0 jump, 4144 0 right, 4144 1 fire, 4145 0 fire,
4148 1 right, 4162 0 right, 4162 1 fire, 4163 0 fire, 4166 1 right, 4166 1 jump, 4168 0 right, 4176 0 jump, 4180 1 fire, 4181 0 fire,
4198 1 fire, 4199 0 fire, 4206 1 right, 4206 1 jump, 4208 0 right, 4216 0 jump, 4216 1 right, 4216 1 fire, 4217 0 fire, 4234 1 fire,
4235 0 fire, 4250 0 right, 4252 1 fire, 4253 0 fire, 4260 1 left, 4270 1 fire, 4271 0 fire, 4288 0 left, 4288 1 fire, 4289 0 fire,
4306 1 fire, 4307 0 fire, 4324 1 fire, 4325 0 fire, 4326 1 right, 4326 1 jump, 4328 0 right, 4330 1 left, 4336 0 jump, 4338 0 left,
4342 1 fire, 4343 0 fire, 4360 1 fire, 4361 0 fire, 4366 1 jump, 4370 1 left, 4376 0 jump, 4376 0 left, 4378 1 fire, 4379 0 fire,
4388 1 right, 4396 1 fire, 4397 0 fire, 4414 1 fire, 4415 0 fire, 4420 1 left, 4420 0 right, 4432 1 fire, 4433 0 fire, 4436 0 left,
4450 1 fire, 4451 0 fire, 4460 1 left, 4468 1 fire, 4469 0 fire, 4478 0 left, 4486 1 fire, 4487 0 fire, 4504 1 fire, 4505 0 fire,
4522 1 fire, 4523 0 fire, 4526 1 right, 4526 1 jump, 4528 0 right, 4540 1 fire, 4541 0 fire, 4548 0 jump, 4556 1 right, 4558 0 right,
4558 1 fire, 4559 0 fire, 4560 1 right, 4562 0 right, 4576 1 fire, 4577 0 fire, 4594 1 right, 4594 1 fire, 4595 0 fire, 4612 1 fire,
4613 0 fire, 4630 1 fire, 4631 0 fire, 4648 1 fire, 4649 0 fire, 4654 1 jump, 4656 0 right, 4660 1 left, 4666 1 fire, 4667 0 fire,
4676 0 jump, 4684 1 fire, 4685 0 fire, 4696 0 left, 4702 1 fire, 4703 0 fire, 4720 1 fire, 4721 0 fire, 4722 1 right, 4722 1 jump,
4724 0 right, 4738 1 fire, 4739 0 fire, 4744 0 jump, 4748 1 left, 4756 1 fire, 4757 0 fire, 4760 0 left, 4760 1 right, 4764 1 jump,
4766 1 left, 4766 0 right, 4774 0 jump, 4774 1 fire, 4775 0 fire, 4778 0 left, 4792 1 fire, 4793 0 fire, 4804 1 jump, 4808 1 right,
4810 1 fire, 4811 0 fire, 4812 0 right, 4814 0 jump, 4828 1 fire, 4829 0 fire, 4835 1 right, 5137 1 jump, 5149 0 jump, 5178 1 jump,
5185 0 jump, 5284 1 fire, 5285 0 fire, 5511 1 jump, 5523 0 jump, 5655 1 jump, 5667 0 jump, 5698 1 jump, 5710 0 jump, 5794 1 jump,
5806 0 jump, 5828 1 jump, 5840 0 jump, 5949 1 fire, 5950 0 fire, 6096 1 jump, 6138 0 jump, 6281 1 jump, 6288 0 jump, 6321 1 fire,
6322 0 fire, 6476 1 jump, 6518 0 jump, 6820 1 fire, 6821 0 fire, 6834 0 right, 6838 1 fire, 6839 0 fire, 6858 1 right, 6858 1 jump,
6860 0 right, 6860 1 fire, 6861 0 fire, 6878 1 fire, 6879 0 fire, 6888 1 right, 6894 0 right, 6896 1 right, 6898 0 jump, 6898 0 right,
6900 1 right, 6900 1 fire, 6901 0 fire, 6902 0 right, 6904 1 right, 6908 0 right, 6912 1 right, 6914 0 right, 6916 1 right,
6918 0 right, 6918 1 fire, 6919 0 fire, 6920 1 right, 6924 0 right, 6928 1 left, 6938 0 left, 6938 1 right, 6938 1 jump, 6940 1 left,
6940 0 right, 6940 1 fire, 6941 0 fire, 6958 1 fire, 6959 0 fire, 6972 0 left, 6978 0 jump, 6980 1 fire, 6981 0 fire, 6998 1 right,
6998 1 fire, 6999 0 fire, 7006 1 jump, 7014 0 right, 7020 1 fire, 7021 0 fire, 7026 1 right, 7038 1 fire, 7039 0 fire, 7046 0 jump,
7060 1 fire, 7061 0 fire, 7078 0 right, 7078 1 fire, 7079 0 fire, 7098 1 fire, 7099 0 fire, 7104 1 right, 7106 1 left, 7106 0 right,
7108 0 left, 7108 1 right, 7110 1 left, 7110 0 right, 7118 1 jump, 7118 1 fire, 7119 0 fire, 7130 0 left, 7138 1 fire, 7139 0 fire,
7140 0 jump, 7142 1 right, 7156 0 right, 7158 1 fire, 7159 0 fire, 7160 1 right, 7160 1 jump, 7162 0 right, 7178 1 fire, 7179 0 fire,
7182 0 jump, 7198 1 fire, 7199 0 fire, 7202 1 right, 7202 1 jump, 7206 1 left, 7206 0 right, 7210 0 left, 7210 1 right, 7212 0 jump,
7216 1 fire, 7217 0 fire, 7218 0 right, 7234 1 fire, 7235 0 fire, 7254 1 right, 7256 1 left, 7256 0 right, 7256 1 fire, 7257 0 fire,
7258 0 left, 7258 1 right, 7260 1 left, 7260 0 right, 7274 1 fire, 7275 0 fire, 7280 0 left, 7292 1 fire, 7293 0 fire, 7314 1 right,
7314 1 fire, 7315 0 fire, 7320 0 right, 7322 1 right, 7324 0 right, 7328 1 right, 7330 0 right, 7332 1 right, 7332 1 fire, 7333 0 fire,
7334 0 right, 7336 1 right, 7338 0 right, 7354 1 fire, 7355 0 fire, 7372 1 fire, 7373 0 fire, 7394 1 fire, 7395 0 fire, 7404 1 right,
7406 1 left, 7406 0 right, 7408 0 left, 7408 1 right, 7410 1 left, 7410 0 right, 7412 1 fire, 7413 0 fire, 7430 0 left, 7430 1 fire,
7431 0 fire, 7442 1 right, 7452 0 right, 7452 1 fire, 7453 0 fire, 7470 1 fire, 7471 0 fire, 7488 1 fire, 7489 0 fire, 7494 1 right,
7494 1 jump, 7496 0 right, 7500 1 right, 7504 0 jump, 7510 0 right, 7510 1 fire, 7511 0 fire, 7524 1 right
`
  .split(/[,\n]/u)
  .map((entry) => entry.trim())
  .filter((entry) => entry !== "")
  .map((entry) => entry.split(" "));

export function sampleRun(): RunRecord {
  return {
    claims: [
      "first-egg",
      "eggs-60",
      "golden-egg",
      "golden-eggs-3",
      "fire-breath",
      "ice-melter",
      "cheer-5",
      "hills-clear",
      "hills-no-bumps",
      "hills-guards",
      "hills-rocket-eggs",
      "secret-charm",
      "metaplasma-300",
    ],
    config: { cabinet: "hills" },
    gameId,
    inputs: [
      ...choices.map(([tick, on, type]) => ({
        data: { on: Number(on), tick: Number(tick) },
        type: type ?? "",
      })),
      { data: { tick: 7622 }, type: "end" },
    ],
    schemaVersion: 1,
    seed: 20261031,
    verifier: verifierId,
    verifierVersion,
  };
}
