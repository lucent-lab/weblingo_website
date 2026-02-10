import "server-only";

type HeaderLike = { get(name: string): string | null };

export function getClientIpFromHeaders(headers: HeaderLike): string {
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  for (const candidate of candidates) {
    // x-forwarded-for can be a list: client, proxy1, proxy2
    const first = candidate.split(",")[0]?.trim() ?? "";
    if (first) {
      return first;
    }
  }

  return "unknown";
}

export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}
