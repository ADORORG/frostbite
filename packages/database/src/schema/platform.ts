import { pgSchema } from "drizzle-orm/pg-core";

export const DATABASE_SCHEMA_NAME = "frostbite";

export const platformSchema = pgSchema(DATABASE_SCHEMA_NAME);
