export { env, type ClientEnv } from "./env";
export { envServer, type FullEnv, type ServerEnv } from "./env-server";
// Note: redis is NOT exported from barrel to avoid client-side bundling.
// Import directly from "@internal/core/redis" in server-only code.
