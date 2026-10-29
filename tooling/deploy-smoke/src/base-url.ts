const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The address to check, as the origin people will use. A deployment is only checked over https (a check that quietly accepted http
// would call an insecure deployment healthy); only a machine's own loopback address may be plain http, for trying this tool locally.
export function parseBaseUrl(text: string): URL {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`"${text}" is not an address.`);
  }
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && loopback.has(url.hostname))
  )
    throw new Error(
      "A deployment is checked over https; only localhost may use http.",
    );
  if (url.username !== "" || url.password !== "")
    throw new Error("The address must not carry a user name or password.");
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "")
    throw new Error("Give the origin only, such as https://example.org.");
  return url;
}
