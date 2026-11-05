import type { EmailAddressesView } from "@frostbite/auth";

// The account's email addresses as the page is given them, from just the addresses: each added a day apart from 1 October 2026 (the first
// the oldest), and room for `maximum` of them.
export const emailView = (
  addresses: readonly string[],
  maximum = 5,
): EmailAddressesView => ({
  addresses: addresses.map((address, at) => ({
    addedAt: new Date(Date.UTC(2026, 9, 1 + at, 9, 30)).toISOString(),
    address,
  })),
  maximum,
});
