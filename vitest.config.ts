import type { ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = {
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
  },
};

export default config;
