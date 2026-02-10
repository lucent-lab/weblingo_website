import "server-only";

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request body too large");
    this.name = "RequestBodyTooLargeError";
  }
}

export class RequestBodyInvalidJsonError extends Error {
  constructor() {
    super("invalid json body");
    this.name = "RequestBodyInvalidJsonError";
  }
}

export async function readJsonBodyLimited(
  request: Request,
  options: { maxBytes: number },
): Promise<unknown> {
  if (!Number.isInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new Error("[config] maxBytes must be a positive integer");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > options.maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    throw new RequestBodyInvalidJsonError();
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();

  let total = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      total += value.byteLength;
      if (total > options.maxBytes) {
        throw new RequestBodyTooLargeError();
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } catch (error) {
    // Ensure we don't keep reading if we hit a size cap or any other error.
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyInvalidJsonError();
  }
}
