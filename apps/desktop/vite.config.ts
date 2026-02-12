import tailwindcss from "@tailwindcss/vite";
import { join } from "node:path";
import type { UserConfig } from "vite";
import solid from "vite-plugin-solid";

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, "../..");

const config: UserConfig = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  base: "./", // Use relative paths for Electron file:// protocol
  envDir: PROJECT_ROOT,
  resolve: {
    dedupe: ["solid-js", "@solidjs/router"],
    alias: [
      { find: "@renderer", replacement: join(PACKAGE_ROOT, "src") },
      { find: "/@/", replacement: join(PACKAGE_ROOT, "src") + "/" },
      { find: "@/core/hooks", replacement: join(PACKAGE_ROOT, "src/core/chat/hooks") },
      { find: "@/core/state/contexts", replacement: join(PACKAGE_ROOT, "src/core/state/contexts") },
      {
        find: "@/core/state/providers",
        replacement: join(PACKAGE_ROOT, "src/core/state/providers"),
      },
      { find: /^@\/state\/(.*)$/, replacement: join(PACKAGE_ROOT, "src/core/state/$1") },
      { find: /^@\/services\/(.*)$/, replacement: join(PACKAGE_ROOT, "src/core/services/$1") },
      { find: /^@\/shared\/(.*)$/, replacement: join(PACKAGE_ROOT, "src/core/shared/$1") },
      { find: "@/routes", replacement: join(PACKAGE_ROOT, "src/routes") },
      { find: "@/components/parts", replacement: join(PACKAGE_ROOT, "src/components/parts") },
      { find: "@/", replacement: join(PACKAGE_ROOT, "src") + "/" },
    ],
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.MODE === "development",
    rollupOptions: {
      input: join(PACKAGE_ROOT, "index.html"),
    },
  },
  plugins: [solid(), tailwindcss()],
};

export default config;
