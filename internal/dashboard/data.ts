import { createHash } from "node:crypto";

import { cache } from "react";

import { redis } from "@/internal/core/redis";

import type { WebhooksAuthContext } from "./auth";
import { isDashboardE2eMockEnabled } from "./e2e-mock";
import {
  fetchSiteCustomerOverview,
  listSites,
  listSupportedLanguages,
  type SiteCustomerOverviewResponse,
  type SiteSummary,
  type SupportedLanguage,
} from "./webhooks";

const SITES_CACHE_NAMESPACE = "dashboard:sites";
const SITE_DASHBOARD_CACHE_INDEX_NAMESPACE = "dashboard:site-dashboard:index";
const SITE_DASHBOARD_PROJECTION_CACHE_NAMESPACE = "dashboard:site-dashboard-projection";
const LANGUAGES_CACHE_KEY = "dashboard:supported-languages";
const SITES_CACHE_TTL_SECONDS = 600;
const SITE_DASHBOARD_CACHE_TTL_SECONDS = 30;
const SITE_DASHBOARD_CACHE_INDEX_TTL_SECONDS = 300;
const LANGUAGES_CACHE_TTL_SECONDS = 21600;

const sitesInflight = new Map<string, Promise<SiteSummary[]>>();
const siteCustomerOverviewInflight = new Map<string, Promise<SiteCustomerOverviewResponse>>();
const languagesInflight = new Map<string, Promise<SupportedLanguage[]>>();

function shouldBypassDashboardCache(): boolean {
  // Avoid external cache network flakiness during dashboard mock-mode smoke runs.
  return isDashboardE2eMockEnabled();
}

function getCacheEnvPrefix(): string {
  if (typeof process.env.VERCEL_ENV === "string") {
    return process.env.VERCEL_ENV;
  }
  if (typeof process.env.NODE_ENV === "string") {
    return process.env.NODE_ENV;
  }
  return "unknown";
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

function getSiteDashboardCacheIndexKey(subjectAccountId: string, siteId: string): string {
  const digest = hashToken(`${subjectAccountId}:${siteId}`);
  return `${SITE_DASHBOARD_CACHE_INDEX_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;
}

function getSiteCustomerOverviewCacheKey(subjectAccountId: string, siteId: string): string {
  const digest = hashToken(`${subjectAccountId}:${siteId}:view:overview`);
  return `${SITE_DASHBOARD_PROJECTION_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${digest}`;
}

export const listSitesCached = cache(async (auth: WebhooksAuthContext) => {
  if (shouldBypassDashboardCache()) {
    return listSites(auth);
  }

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

export const getSiteSummaryCached = cache(async (auth: WebhooksAuthContext, siteId: string) => {
  const sites = await listSitesCached(auth);
  return sites.find((site) => site.id === siteId) ?? null;
});

export const getSiteTargetLangsCached = cache(async (auth: WebhooksAuthContext, siteId: string) => {
  const site = await getSiteSummaryCached(auth, siteId);
  if (!site) {
    return null;
  }
  return normalizeTargetLangs(site.targetLangs);
});

export const listSupportedLanguagesCached = cache(async () => {
  if (shouldBypassDashboardCache()) {
    return listSupportedLanguages();
  }

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

function normalizeTargetLangs(targetLangs: string[]): string[] {
  return Array.from(new Set(targetLangs.map((lang) => lang.trim()).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right),
  );
}

export const getSiteCustomerOverviewCached = cache(
  async (auth: WebhooksAuthContext, siteId: string): Promise<SiteCustomerOverviewResponse> => {
    if (shouldBypassDashboardCache()) {
      return fetchSiteCustomerOverview(auth, siteId);
    }

    const cacheKey = getSiteCustomerOverviewCacheKey(auth.subjectAccountId, siteId);
    const indexKey = getSiteDashboardCacheIndexKey(auth.subjectAccountId, siteId);

    try {
      const cached = await redis.get<SiteCustomerOverviewResponse>(cacheKey);
      if (cached) {
        console.info("[dashboard] site customer overview cache hit");
        return cached;
      }
    } catch (error) {
      console.warn("[dashboard] site customer overview cache read failed:", error);
    }

    console.info("[dashboard] site customer overview cache miss");

    const inflight = siteCustomerOverviewInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = (async () => {
      const payload = await fetchSiteCustomerOverview(auth, siteId);
      try {
        await redis.set(cacheKey, payload, { ex: SITE_DASHBOARD_CACHE_TTL_SECONDS });
        await redis.sadd(indexKey, cacheKey);
        await redis.expire(indexKey, SITE_DASHBOARD_CACHE_INDEX_TTL_SECONDS);
      } catch (error) {
        console.warn("[dashboard] site customer overview cache write/index failed:", error);
      }
      return payload;
    })();

    siteCustomerOverviewInflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      siteCustomerOverviewInflight.delete(cacheKey);
    }
  },
);

export async function invalidateSitesCache(auth: WebhooksAuthContext): Promise<void> {
  if (shouldBypassDashboardCache()) {
    return;
  }

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
  if (shouldBypassDashboardCache()) {
    return;
  }

  const indexKey = getSiteDashboardCacheIndexKey(auth.subjectAccountId, siteId);
  const keys = new Set<string>([
    getSiteCustomerOverviewCacheKey(auth.subjectAccountId, siteId),
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
