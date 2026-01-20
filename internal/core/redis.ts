import { Redis } from "@upstash/redis";

import { env } from "./env";

void env;

export const redis = Redis.fromEnv();
