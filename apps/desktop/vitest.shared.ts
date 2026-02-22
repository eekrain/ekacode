import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts", "./tests/vitest.setup.ts"],
    server: {
      deps: {
        inline: [
          "@solidjs/router",
          "@kobalte/core",
          "@kobalte/core/collapsible",
          "@corvu/utils",
          "@corvu/resizable",
          "solid-presence",
          "solid-prevent-scroll",
          "lucide-solid",
        ],
      },
    },
    deps: {
      optimizer: {
        web: {
          include: ["solid-js", "solid-js/web", "@solidjs/router", "lucide-solid"],
        },
      },
    },
  },
});
