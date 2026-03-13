import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const testFiles = [
  "**/*.test.{ts,tsx,js,jsx}",
  "**/*.spec.{ts,tsx,js,jsx}",
  "tests/**/*.{ts,tsx,js,jsx}",
];

const firstWaveStrictFiles = ["app/api/**/*.ts", "internal/**/*.ts", "lib/**/*.ts"];

const strictBooleanExpressionsRule = [
  "error",
  {
    allowString: true,
    allowNumber: true,
    allowNullableObject: true,
    allowNullableBoolean: false,
    allowNullableString: true,
    allowNullableNumber: true,
    allowAny: false,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    ".tmp/**",
    "next-env.d.ts",
    "types/database.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },
  {
    files: [
      "app/api/**/*.{ts,tsx,js,jsx}",
      "app/**/actions.{ts,tsx,js,jsx}",
      "lib/supabase/admin.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Do not use raw fetch() in server code. Use fetchWithTimeout(...) from internal/core/fetch-timeout instead.",
        },
      ],
    },
  },
  {
    files: ["internal/core/fetch-timeout.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: firstWaveStrictFiles,
    ignores: testFiles,
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false,
          },
        },
      ],
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/strict-boolean-expressions": strictBooleanExpressionsRule,
    },
  },
  {
    files: [
      "app/**/*.{tsx,jsx}",
      "components/**/*.{tsx,jsx}",
      "modules/**/*.{tsx,jsx}",
      "internal/**/*.tsx",
    ],
    rules: {
      "@typescript-eslint/strict-boolean-expressions": "off",
    },
  },
  {
    files: testFiles,
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
    },
  },
]);

export default eslintConfig;
