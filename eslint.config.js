const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "*.local",
      "packages/*/out/**",
      "apps/desktop/src/components/reference/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["apps/desktop/src/**/*.ts", "apps/desktop/src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@ekacode/desktop/presentation/providers",
                "@ekacode/desktop/presentation/providers/*",
              ],
              message: "Use @renderer/presentation/providers/* imports in runtime desktop code.",
            },
            {
              group: [
                "../presentation/providers/*",
                "../../presentation/providers/*",
                "../../../presentation/providers/*",
                "../../../../presentation/providers/*",
              ],
              message: "Use @renderer/presentation/providers/* imports in runtime desktop code.",
            },
          ],
        },
      ],
    },
  },
];
