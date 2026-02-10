import "server-only";

export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  const forwarded = candidates[0] ?? "";
  if (forwarded) {
    // x-forwarded-for can be a list: client, proxy1, proxy2
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) {
      return first;
    }
  }

  return "unknown";
}
