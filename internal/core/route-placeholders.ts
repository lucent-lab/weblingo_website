const UNRESOLVED_ROUTE_PLACEHOLDER_RE = /[{}]|%7b|%7d/i;

export function hasUnresolvedRoutePlaceholder(value: string): boolean {
  return UNRESOLVED_ROUTE_PLACEHOLDER_RE.test(value);
}
