/**
 * Drizzle Kit configuration
 */

import { resolveAppPaths } from "@ekacode/shared/paths";
import type { Config } from "drizzle-kit";

const paths = resolveAppPaths();

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: paths.ekacodeDbUrl,
  },
} satisfies Config;
