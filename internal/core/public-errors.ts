import "server-only";

import { randomBytes } from "node:crypto";

export type PublicErrorBody = {
  error: string;
  request_id: string;
};

export function isProdEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export function buildRequestId(): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (maybeCrypto?.randomUUID) {
    return maybeCrypto.randomUUID();
  }
  // Best-effort fallback; only used when randomUUID isn't available.
  // Use cryptographic entropy (avoid Math.random()) and keep length stable.
  return `req_${Date.now().toString(36)}_${randomBytes(12).toString("hex")}`;
}

export function buildPublicErrorBody(options: {
  error: string;
  requestId: string;
}): PublicErrorBody {
  return { error: options.error, request_id: options.requestId };
}
