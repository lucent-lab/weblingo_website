import "server-only";

export class FetchTimeoutError extends Error {
  constructor(message = "fetch timed out") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<Response> {
  const timeoutMs = options.timeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error("[config] timeoutMs must be a positive integer");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const callerSignal = options.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new FetchTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
