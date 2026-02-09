import "server-only";

import { Redis } from "@upstash/redis";

import { envServer } from "./env-server";

void envServer;

export const redis = Redis.fromEnv();
