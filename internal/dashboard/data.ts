import { createHash } from "node:crypto";

import { cache } from "react";

import { redis } from "@/internal/core/redis";

import type { WebhooksAuthContext } from "./auth";
import {
  fetchSiteDashboard,
  listSites,
  listSupportedLanguages,
  type SiteDashboardResponse,
  type SiteSummary,
  type SupportedLanguage,
} from "./webhooks";

const SITES_CACHE_NAMESPACE = "dashboard:sites";
const SITE_DASHBOARD_CACHE_NAMESPACE = "dashboard:site-dashboard";
const SITE_DASHBOARD_CACHE_INDEX_NAMESPACE = "dashboard:site-dashboard:index";
const LANGUAGES_CACHE_KEY = "dashboard:supported-languages";
const SITES_CACHE_TTL_SECONDS = 600;
const SITE_DASHBOARD_CACHE_TTL_SECONDS = 30;
const SITE_DASHBOARD_CACHE_INDEX_TTL_SECONDS = 300;
const LANGUAGES_CACHE_TTL_SECONDS = 21600;

const sitesInflight = new Map<string, Promise<SiteSummary[]>>();
const siteDashboardInflight = new Map<string, Promise<SiteDashboardResponse>>();
const languagesInflight = new Map<string, Promise<SupportedLanguage[]>>();

function getCacheEnvPrefix(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSitesCacheKey(subjectAccountId: string): string {
  return `${SITES_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${hashToken(subjectAccountId)}`;
}

function getLanguagesCacheKey(): string {
  return `${LANGUAGES_CACHE_KEY}:${getCacheEnvPrefix()}`;
}

type SiteDashboardCacheOptions = {
  includePages?: boolean;
  limit?: number;
  offset?: number;
};

type NormalizedSiteDashboardOptions = {
  includePages: boolean;
  limit: number;
  offset: number;
};

function normalizeSiteDashboardOptions(
  options?: SiteDashboardCacheOptions,
): NormalizedSiteDashboardOptions {
  const includePages = options?.includePages === true;
  if (!includePages) {
    return { includePages: false, limit: 25, offset: 0 };
  }
  return {
    includePages,
    limit: typeof options.limit === "number" ? options.limit : 25,
    offset: typeof options.offset === "number" ? options.offset : 0,
  };
}

function getSiteDashboardCacheKey(
  subjectAccountId: string,
  siteId: string,
  options?: SiteDashboardCacheOptions,
): string {
  const normalized = normalizeSiteDashboardOptions(options);
  const suffix = normalized.includePages
    ? `pages:${normalized.limit}:${normalized.offset}`
    : "pages:none";
  const digest = hashToken(`${subjectAccountId}:${siteId}:${suffix}`);
  return `${SITE_DASHBOARD_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;
}

function getSiteDashboardCacheIndexKey(subjectAccountId: string, siteId: string): string {
  const digest = hashToken(`${subjectAccountId}:${siteId}`);
  return `${SITE_DASHBOARD_CACHE_INDEX_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;
}

export const listSitesCached = cache(async (auth: WebhooksAuthContext) => {
  const cacheKey = getSitesCacheKey(auth.subjectAccountId);

  try {
    const cached = await redis.get<SiteSummary[]>(cacheKey);
    if (cached) {
      console.info("[dashboard] sites cache hit");
      return cached;
    }
  } catch (error) {
    console.warn("[dashboard] sites cache read failed:", error);
  }

  console.info("[dashboard] sites cache miss");

  const inflight = sitesInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const sites = await listSites(auth);
    try {
      await redis.set(cacheKey, sites, { ex: SITES_CACHE_TTL_SECONDS });
    } catch (error) {
      console.warn("[dashboard] sites cache write failed:", error);
    }
    return sites;
  })();

  sitesInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    sitesInflight.delete(cacheKey);
  }
});

export const listSupportedLanguagesCached = cache(async () => {
  const cacheKey = getLanguagesCacheKey();

  try {
    const cached = await redis.get<SupportedLanguage[]>(cacheKey);
    if (cached) {
      console.info("[dashboard] languages cache hit");
      return cached;
    }
  } catch (error) {
    console.warn("[dashboard] languages cache read failed:", error);
  }

  console.info("[dashboard] languages cache miss");

  const inflight = languagesInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const languages = await listSupportedLanguages();
    try {
      await redis.set(cacheKey, languages, { ex: LANGUAGES_CACHE_TTL_SECONDS });
    } catch (error) {
      console.warn("[dashboard] languages cache write failed:", error);
    }
    return languages;
  })();

  languagesInflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    languagesInflight.delete(cacheKey);
  }
});

export const getSiteDashboardCached = cache(
  async (
    auth: WebhooksAuthContext,
    siteId: string,
    options?: SiteDashboardCacheOptions,
  ): Promise<SiteDashboardResponse> => {
    const normalized = normalizeSiteDashboardOptions(options);
    const cacheKey = getSiteDashboardCacheKey(auth.subjectAccountId, siteId, normalized);
    const indexKey = getSiteDashboardCacheIndexKey(auth.subjectAccountId, siteId);

    try {
      const cached = await redis.get<SiteDashboardResponse>(cacheKey);
      if (cached) {
        console.info("[dashboard] site dashboard cache hit");
        return cached;
      }
    } catch (error) {
      console.warn("[dashboard] site dashboard cache read failed:", error);
    }

    console.info("[dashboard] site dashboard cache miss");

    const inflight = siteDashboardInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      const payload = await fetchSiteDashboard(auth, siteId, normalized);
      try {
        await redis.set(cacheKey, payload, { ex: SITE_DASHBOARD_CACHE_TTL_SECONDS });
        await redis.sadd(indexKey, cacheKey);
        await redis.expire(indexKey, SITE_DASHBOARD_CACHE_INDEX_TTL_SECONDS);
      } catch (error) {
        console.warn("[dashboard] site dashboard cache write/index failed:", error);
      }
      return payload;
    })();

    siteDashboardInflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      siteDashboardInflight.delete(cacheKey);
    }
  },
);

export async function invalidateSitesCache(auth: WebhooksAuthContext): Promise<void> {
  const cacheKey = getSitesCacheKey(auth.subjectAccountId);
  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.warn("[dashboard] sites cache invalidate failed:", error);
  }
}

export async function invalidateSiteDashboardCache(
  auth: WebhooksAuthContext,
  siteId: string,
): Promise<void> {
  const indexKey = getSiteDashboardCacheIndexKey(auth.subjectAccountId, siteId);
  const keys = new Set<string>([
    getSiteDashboardCacheKey(auth.subjectAccountId, siteId),
    getSiteDashboardCacheKey(auth.subjectAccountId, siteId, {
      includePages: true,
      limit: 25,
      offset: 0,
    }),
    indexKey,
  ]);
  try {
    const indexedKeys = await redis.smembers<string[]>(indexKey);
    for (const key of indexedKeys) {
      if (typeof key === "string" && key) {
        keys.add(key);
      }
    }
    await redis.del(...Array.from(keys));
  } catch (error) {
    console.warn("[dashboard] site dashboard cache invalidate failed:", error);
  }
}
