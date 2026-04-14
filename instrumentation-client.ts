import posthog from "posthog-js";
import { env } from "@internal/core";
import { buildPosthogProxyApiHost } from "@internal/analytics/proxy";

posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: buildPosthogProxyApiHost(env.NEXT_PUBLIC_APP_URL),
  defaults: "2025-05-24",
});
