import {
  emailMethodKind,
  type ContactLinkService,
  type EmailAddressesView,
} from "@ador/auth";

// The account's email addresses as the account page and its list route both show them: the oldest first, each with the moment it was added
// (as text, so it crosses the wire and the server-to-browser boundary unchanged), and how many the account may hold. One place makes it.
export async function emailAddressesView(
  service: Pick<ContactLinkService, "addresses">,
  userId: string,
): Promise<EmailAddressesView> {
  const { addresses, maximum } = await service.addresses(
    userId,
    emailMethodKind,
  );
  return {
    addresses: addresses.map(({ addedAt, value }) => ({
      addedAt: addedAt.toISOString(),
      address: value,
    })),
    maximum,
  };
}
