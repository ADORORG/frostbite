import { z } from "zod";

// Schemas are never compiled at run time: a game runs under a policy that forbids script evaluation, and the
// library's probe for it would be reported as a violation. Validation behaves the same either way. This module
// is imported first, before any schema exists.
z.config({ jitless: true });
