import "server-only";

import { Redis } from "@upstash/redis";

import { envServer } from "./env-server";

void envServer;

const redisRestUrl = envServer.UPSTASH_REDIS__KV_REST_API_URL;
const redisRestToken = envServer.UPSTASH_REDIS__KV_REST_API_TOKEN;

if (!redisRestUrl || !redisRestToken) {
  throw new Error(
    "[config] Missing Redis REST credentials. Set UPSTASH_REDIS__KV_REST_API_URL and UPSTASH_REDIS__KV_REST_API_TOKEN.",
  );
}

export const redis = new Redis({
  url: redisRestUrl,
  token: redisRestToken,
});
