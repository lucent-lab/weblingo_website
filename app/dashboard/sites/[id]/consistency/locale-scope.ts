export type ConsistencyLocaleScope = {
  sourceLang: string;
  targetLang: string;
};

function normalizeLocaleScopePart(value: string) {
  return value.trim();
}

export function buildConsistencyLocaleScopes(
  locales: Array<Pick<ConsistencyLocaleScope, "sourceLang" | "targetLang">>,
): ConsistencyLocaleScope[] {
  const seen = new Set<string>();
  const scopes: ConsistencyLocaleScope[] = [];

  for (const locale of locales) {
    const sourceLang = normalizeLocaleScopePart(locale.sourceLang);
    const targetLang = normalizeLocaleScopePart(locale.targetLang);
    if (!sourceLang || !targetLang) {
      continue;
    }

    const key = `${sourceLang}|${targetLang}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    scopes.push({ sourceLang, targetLang });
  }

  return scopes;
}

export function selectConsistencyLocaleScope(
  scopes: ConsistencyLocaleScope[],
  searchParams?: { sourceLang?: string; targetLang?: string },
): ConsistencyLocaleScope | null {
  if (scopes.length === 0) {
    return null;
  }

  const requestedSourceLang = normalizeLocaleScopePart(searchParams?.sourceLang ?? "");
  const requestedTargetLang = normalizeLocaleScopePart(searchParams?.targetLang ?? "");

  if (requestedSourceLang && requestedTargetLang) {
    const exactMatch = scopes.find(
      (scope) =>
        scope.sourceLang === requestedSourceLang && scope.targetLang === requestedTargetLang,
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  if (requestedTargetLang) {
    const targetMatch = scopes.find((scope) => scope.targetLang === requestedTargetLang);
    if (targetMatch) {
      return targetMatch;
    }
  }

  return scopes[0] ?? null;
}

export function formatConsistencyLocaleScopeLabel(scope: ConsistencyLocaleScope) {
  return `${scope.sourceLang} → ${scope.targetLang}`;
}
