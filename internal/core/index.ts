export { env, type ClientEnv } from "./env";
// Note: keep this barrel client-safe. Import server-only modules directly:
// - `@internal/core/env-server`
// - `@internal/core/redis`
