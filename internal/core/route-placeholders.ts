const UNRESOLVED_ROUTE_PLACEHOLDER_RE = /(?:\{lang\}|%7blang%7d)/i;

export function hasUnresolvedRoutePlaceholder(value: string): boolean {
  return UNRESOLVED_ROUTE_PLACEHOLDER_RE.test(value);
}
