import tailwindcss from "@tailwindcss/vite";
import { join, resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "./vitest.shared";

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, "../..");

// Define explicit paths
const SHARED_SRC = resolve(PACKAGE_ROOT, "../../packages/shared/src");
const CORE_SRC = resolve(PACKAGE_ROOT, "../../packages/core/src");
const DESKTOP_SRC = resolve(PACKAGE_ROOT, "src");

export default mergeConfig(
  shared,
  defineConfig({
    mode: process.env.MODE,
    root: PACKAGE_ROOT,
    base: "./",
    envDir: PROJECT_ROOT,
    resolve: {
      alias: {
        // From original vite.config.ts
        "@renderer": join(PACKAGE_ROOT, "src"),
        "/@/": join(PACKAGE_ROOT, "src") + "/",

        // Workspace dependencies
        "@sakti-code/shared": SHARED_SRC,
        "@sakti-code/shared/event-guards": SHARED_SRC + "/event-guards.ts",
        "@sakti-code/shared/event-types": SHARED_SRC + "/event-types.ts",
        "@sakti-code/shared/binary": SHARED_SRC + "/binary.ts",
        "@sakti-code/shared/persist": SHARED_SRC + "/persist.ts",
        "@sakti-code/shared/paths": SHARED_SRC + "/paths.ts",
        "@sakti-code/shared/retry": SHARED_SRC + "/retry.ts",
        "@sakti-code/shared/shutdown": SHARED_SRC + "/shutdown.ts",
        "@sakti-code/shared/logger": SHARED_SRC + "/logger/index.ts",

        "@sakti-code/core": CORE_SRC,
        "@sakti-code/core/chat": CORE_SRC + "/chat",
        "@sakti-code/core/server": CORE_SRC + "/server",
        "@sakti-code/core/tools": CORE_SRC + "/tools",
        "@/utils": DESKTOP_SRC + "/utils",
        "@/shared": DESKTOP_SRC + "/core/shared",
        "@/shared/": DESKTOP_SRC + "/core/shared/",
        "@/infrastructure/api": DESKTOP_SRC + "/core/services/api",
        "@/infrastructure/api/": DESKTOP_SRC + "/core/services/api/",

        "@renderer/presentation/providers/": DESKTOP_SRC + "/core/state/providers/",
        "@renderer/providers/workspace-provider":
          DESKTOP_SRC + "/core/state/providers/workspace-provider.tsx",

        "@/components": DESKTOP_SRC + "/components",
        "@/components/*": DESKTOP_SRC + "/components/*",
        "@/core": DESKTOP_SRC + "/core",
        "@/core/*": DESKTOP_SRC + "/core/*",
        "@/state": DESKTOP_SRC + "/core/state",
        "@/state/*": DESKTOP_SRC + "/core/state/*",
        "@/views": DESKTOP_SRC + "/views",
        "@/views/*": DESKTOP_SRC + "/views/*",
        "@/services": DESKTOP_SRC + "/core/services",
        "@/services/*": DESKTOP_SRC + "/core/services/*",
        "@/shared": DESKTOP_SRC + "/core/shared",
        "@/shared/*": DESKTOP_SRC + "/core/shared/*",
        "@/utils": DESKTOP_SRC + "/utils",
        "@/utils/*": DESKTOP_SRC + "/utils/*",
        "@/state/*": DESKTOP_SRC + "/core/state/*",
        "@/views": DESKTOP_SRC + "/views",
        "@/views/*": DESKTOP_SRC + "/views/*",
      },
    },
    build: {
      outDir: "dist",
      sourcemap: process.env.MODE === "development",
      rollupOptions: {
        input: join(PACKAGE_ROOT, "index.html"),
      },
    },
    plugins: [solid(), tailwindcss()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./tests/vitest.setup.ts"],
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
      exclude: [
        "node_modules",
        "dist",
        "tests/e2e/**/*",
        "tests/integration/data-integrity/**/*",
        "tests/helpers/test-server.ts",
      ],
      pool: "threads",
      maxConcurrency: 1,
      fileParallelism: false,
      projects: [
        {
          test: {
            name: "desktop-unit-node",
            include: ["src/**/*.test.ts"],
            environment: "node",
          },
        },
        {
          test: {
            name: "desktop-ui-jsdom",
            include: [
              "src/**/*.test.tsx",
              "tests/unit/**/*.test.tsx",
              "tests/integration/**/*.test.tsx",
            ],
            environment: "jsdom",
          },
        },
        {
          test: {
            name: "desktop-contract",
            include: [
              "tests/e2e/**/*.test.ts",
              "tests/integration/**/*.test.ts",
              "tests/unit/**/*.test.ts",
            ],
            environment: "jsdom",
          },
        },
      ],
    },
  })
);
