import { createHash } from "node:crypto";

import { cache } from "react";

import { redis } from "@/internal/core/redis";

import type { WebhooksAuthContext } from "./auth";
import { listSites, listSupportedLanguages, type Site, type SupportedLanguage } from "./webhooks";

const SITES_CACHE_NAMESPACE = "dashboard:sites";
const LANGUAGES_CACHE_KEY = "dashboard:supported-languages";
const SITES_CACHE_TTL_SECONDS = 600;
const LANGUAGES_CACHE_TTL_SECONDS = 21600;

const sitesInflight = new Map<string, Promise<Site[]>>();
const languagesInflight = new Map<string, Promise<SupportedLanguage[]>>();

function getCacheEnvPrefix(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSitesCacheKey(token: string): string {
  return `${SITES_CACHE_NAMESPACE}:${getCacheEnvPrefix()}:${hashToken(token)}`;
}

function getLanguagesCacheKey(): string {
  return `${LANGUAGES_CACHE_KEY}:${getCacheEnvPrefix()}`;
}

export const listSitesCached = cache(async (auth: WebhooksAuthContext) => {
  const cacheKey = getSitesCacheKey(auth.token);

  try {
    const cached = await redis.get<Site[]>(cacheKey);
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

export async function invalidateSitesCache(auth: WebhooksAuthContext): Promise<void> {
  const cacheKey = getSitesCacheKey(auth.token);
  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.warn("[dashboard] sites cache invalidate failed:", error);
  }
}
