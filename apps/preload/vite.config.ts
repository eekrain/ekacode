import { join } from "node:path";
import type { UserConfig } from "vite";
import dts from "vite-plugin-dts";

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, "../..");

const config: UserConfig = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  ssr: {
    // Force @electron-toolkit/preload to be bundled, not externalized
    // Preload scripts can't require() npm packages in sandbox
    noExternal: ["@electron-toolkit/preload"],
  },
  build: {
    ssr: true,
    sourcemap: "inline",
    target: "chrome130", // Electron's Chrome version
    outDir: "dist",
    lib: {
      entry: {
        index: join(PACKAGE_ROOT, "src/index.ts"),
      },
      formats: ["cjs"], // Preload must be CommonJS
    },
    rollupOptions: {
      // Only externalize 'electron' - everything else must be bundled
      // because preload scripts run in sandbox and can't require() npm packages
      external: ["electron"],
      output: {
        entryFileNames: "[name].cjs",
      },
    },
    emptyOutDir: true,
  },
  plugins: [dts({ rollupTypes: true })],
};

export default config;
