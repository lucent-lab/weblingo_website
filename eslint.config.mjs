import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "types/database.ts"]),
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
]);

export default eslintConfig;
