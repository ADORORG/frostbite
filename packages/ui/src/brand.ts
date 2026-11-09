// What the platform is called, in one place. The shell, the page title and the favicon take it from here; the name in what the platform
// sends (NEXT_PUBLIC_APP_NAME, in the sign-in email) is configuration and is set to the same name in the environment templates.
export const productName = "Frostbite";

// Who built the platform, shown in the footer of every page. The words and the address are one record, so a page cannot say one and link to
// another.
export const builderCredit = {
  href: "https://xpldevelopers.org",
  label: "Built by XPL Developers",
} as const;
