import { parseMailEnvironment } from "@repo/config/mail";

// How the platform sends mail, or null when it is not set up: then nothing that needs mail is offered. Read once, at boot, so a
// misconfiguration stops the process instead of failing at the first person's attempt.
export const mailSettings = parseMailEnvironment(process.env);
