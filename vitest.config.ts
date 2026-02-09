import type { ViteUserConfig } from "vitest/config";
import path from "node:path";

const config: ViteUserConfig = {
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./$1") },
      { find: /^@internal\/(.*)$/, replacement: path.resolve(__dirname, "./internal/$1") },
      { find: /^@modules\/(.*)$/, replacement: path.resolve(__dirname, "./modules/$1") },
      { find: /^@components\/(.*)$/, replacement: path.resolve(__dirname, "./components/$1") },
      {
        find: "server-only",
        replacement: path.resolve(__dirname, "./internal/test-support/server-only.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
};

export default config;
