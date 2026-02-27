/**
 * Vitest configuration for @sakti-code/server
 */

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/vitest.setup.ts"],
    pool: "threads",
    maxConcurrency: 1,
    fileParallelism: false,
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/app/__tests__/**/*.test.ts",
      "schema/**/__tests__/**/*.test.ts",
      "db/__tests__/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/e2e/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.test.ts", "**/*.spec.ts", "**/types/"],
    },
    exclude: ["node_modules", "dist"],
  },
});
