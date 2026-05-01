const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "referer",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function buildPosthogUpstreamUrl(
  upstreamHost: string,
  pathSegments: string[],
  requestUrl: string,
): URL {
  const upstreamUrl = new URL(upstreamHost);
  const incomingUrl = new URL(requestUrl);
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const basePath = normalizeBasePath(upstreamUrl.pathname);

  upstreamUrl.pathname = encodedPath ? `${basePath}/${encodedPath}` : basePath || "/";
  upstreamUrl.search = incomingUrl.search;

  return upstreamUrl;
}

export function buildPosthogProxyRequestHeaders(
  incomingHeaders: Headers,
  requestUrl: string,
): Headers {
  const forwardedHeaders = new Headers();

  incomingHeaders.forEach((value, key) => {
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      return;
    }
    forwardedHeaders.set(key, value);
  });

  const requestOrigin = new URL(requestUrl);
  forwardedHeaders.set("x-forwarded-host", requestOrigin.host);
  forwardedHeaders.set("x-forwarded-proto", requestOrigin.protocol.replace(":", ""));

  return forwardedHeaders;
}

export function buildPosthogProxyResponseHeaders(upstreamHeaders: Headers): Headers {
  const responseHeaders = new Headers();

  upstreamHeaders.forEach((value, key) => {
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      return;
    }
    responseHeaders.set(key, value);
  });

  return responseHeaders;
}

export function shouldForwardRequestBody(method: string): boolean {
  const normalizedMethod = method.trim().toUpperCase();
  return !["GET", "HEAD"].includes(normalizedMethod);
}
