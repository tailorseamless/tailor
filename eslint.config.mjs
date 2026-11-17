import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "server/src/infrastructure/database/migrations/**",
      "client/dev-dist/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["server/**/*.ts"],
    rules: {
      // Backend Guide §1.1 / §29.3 — log with `logger`
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["server/src/config/env.ts", "server/src/infrastructure/database/migrate.ts", "server/scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["server/src/types/express.d.ts"],
    rules: { "@typescript-eslint/no-namespace": "off" },
  },
  {
    // Backend Guide §2 — controllers and routes never reach past the service layer
    files: ["server/src/modules/**/controllers/**/*.ts", "server/src/modules/**/routes/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "typeorm", message: "Controllers and routes go through a service (Backend Guide §2)." }],
          patterns: [
            {
              group: ["**/entities/*", "**/repositories/*", "**/infrastructure/database/*"],
              message: "Controllers and routes go through a service (Backend Guide §2).",
            },
          ],
        },
      ],
    },
  },
  {
    // Backend Guide §14.1 — auth is mounted once, in app.ts
    files: ["server/src/modules/**/routes/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='use'] > Identifier[name='authMiddleware']",
          message: "authMiddleware is mounted once in app.ts (Backend Guide §14.1).",
        },
      ],
    },
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Frontend Guide — pages and components fetch through hooks, never the transport or axios
    files: ["client/src/pages/**/*.{ts,tsx}", "client/src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "axios", message: "Fetch through a hook in src/hooks (Frontend Guide)." }],
          patterns: [
            {
              group: ["**/transport/*", "**/endpoints/*"],
              message: "Fetch through a hook in src/hooks (Frontend Guide).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["client/public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ["client/public/theme-init.js"],
    languageOptions: { globals: globals.browser },
  },
);
