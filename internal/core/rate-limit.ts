import "server-only";

export type RedisCounter = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
};

export type FixedWindowRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  current: number;
  key: string;
};

export async function rateLimitFixedWindow(
  redis: RedisCounter,
  options: {
    key: string;
    limit: number;
    windowMs: number;
    nowMs?: number;
  },
): Promise<FixedWindowRateLimitResult> {
  const nowMs = options.nowMs ?? Date.now();
  const limit = options.limit;
  const windowMs = options.windowMs;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("[config] rateLimitFixedWindow limit must be a positive integer");
  }
  if (!Number.isInteger(windowMs) || windowMs < 1) {
    throw new Error("[config] rateLimitFixedWindow windowMs must be a positive integer");
  }

  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const resetAtMs = windowStartMs + windowMs;
  const windowKey = `${options.key}:${windowStartMs}`;

  const current = await redis.incr(windowKey);
  if (current === 1) {
    await redis.expire(windowKey, Math.ceil(windowMs / 1000));
  }

  return {
    allowed: current <= limit,
    limit,
    remaining: Math.max(0, limit - current),
    resetAtMs,
    current,
    key: windowKey,
  };
}
