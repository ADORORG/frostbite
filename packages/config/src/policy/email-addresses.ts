// How many email addresses one account may hold (ADR-021 point 6, open item), as a record: a change is a new version. Each address is a way
// in, so an unlimited list is an unlimited number of mailboxes that can take the account over, and a person with more than a handful of
// addresses has outgrown what the account page is for. Five covers a person's own mailboxes (personal, work, an old one or two) with
// room to move one over before removing another. A default to confirm with the other ADR-021 numbers.
export const emailAddressPolicy = {
  maximumPerAccount: 5,
  version: 1,
} as const;
