// The land between the woods and the castle, as rows of tiles, south (the village, where Glitchy starts) to north (the castle).
// T tree, . grass, , path, f flowers, s sand, ~ river, L the shallow ford, o boulder, # bramble, I ice, H house, W castle wall,
// c castle floor. Who stands where is in `places.ts`. Every step of the quest can be reached once the step before it is done.
export const mapRows: readonly string[] = [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "TTTTTTTTTTTTWWWWWWWWWWWWWWWWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWWWWWWWcWWWWWWWWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWWWWWWWcWWWWWWWWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWccccccccccccccWTTTTTTTTTTTT",
  "TTTTTTTTTTTTWWWWWWWcWWWWWWWWTTTTTTTTTTTT",
  "TTTf.....T......f..,......T..f..T...HHHT",
  "TT.#.f......f......,......f..........H.T",
  "TTT...T......T.....,.........T.........T",
  "TTTTTTTTTTTTTTTTTTT#TTTTTTTTTTTTTTTTTTTT",
  "TT..........T......,,,,,....T......f.TTT",
  "TT....TTT..............,.......T......TT",
  "TT.f..T.I.....T........,...f......T...TT",
  "TT....TTT..............,......T....f..TT",
  "TTT........f.....T.....,.....f........TT",
  "~~~~~~~~~~~~~~~~~~~~~~~L~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~L~~~~~~~~~~~~~~~~",
  "T..f......T......f.T...,.......TsssssssT",
  "T.HHH.......f..........,...T...TsssssssT",
  "T.HHH...........T......o.......TsssssssT",
  "T......,,,,,,,,,,,,,,,,,,,,,,,,osssssssT",
  "T.HHH..,..................f....TsssssssT",
  "T.HHH..,......T.....f.......T..TsssssssT",
  "T......,..f....................TsssssssT",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
];

export const mapWidth = 40;
export const mapHeight = mapRows.length;

export const tileAt = (x: number, y: number): string => mapRows[y]?.[x] ?? "T";
