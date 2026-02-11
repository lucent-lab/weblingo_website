// Vitest doesn't understand Next's `server-only` virtual import. In production this is handled
// by Next bundling, but for unit tests we alias it to an empty module.
export {};
