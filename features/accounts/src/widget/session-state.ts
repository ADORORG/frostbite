// Whether anyone is signed in, as the server read it for this page. The header does not ask for itself: the server rendered the page under
// one session, and says so. `unknown` is a server that could not tell, which the header shows as neither signed in nor out.
export const sessionStates = ["signed-in", "signed-out", "unknown"] as const;
export type SessionState = (typeof sessionStates)[number];
