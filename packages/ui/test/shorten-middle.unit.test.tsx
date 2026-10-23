import { expect, it } from "vitest";

import { shortenMiddle } from "../src/components/shorten-middle.ts";

it("keeps the start and the end of a long id, and says the rest is left out", () => {
  expect(shortenMiddle("tb1qrxv4phfqavpxjnj37p2k9rd68fxe89q94kpj76")).toBe(
    "tb1qrx…pj76",
  );
  expect(shortenMiddle("0123456789abcdef", { head: 3, tail: 2 })).toBe(
    "012…ef",
  );
});

it("leaves a text that fits whole, up to the room the shortened form would take, and shortens from the next character", () => {
  expect(shortenMiddle("short")).toBe("short");
  // head 6 + tail 4 + the ellipsis and one more: 12 characters fit, 13 do not.
  expect(shortenMiddle("123456789012")).toBe("123456789012");
  expect(shortenMiddle("1234567890123")).toBe("123456…0123");
});
