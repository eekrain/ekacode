import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "electron-vite";
import { resolve } from "node:path";
import solid from "vite-plugin-solid";

export default defineConfig({
  main: {
    build: {},
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [solid(), tailwindcss()],
  },
});
