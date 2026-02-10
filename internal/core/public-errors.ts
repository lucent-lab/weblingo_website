import "server-only";

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
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPublicErrorBody(options: {
  error: string;
  requestId: string;
}): PublicErrorBody {
  return { error: options.error, request_id: options.requestId };
}
