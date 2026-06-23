"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ANALYTICS_EVENTS, extractPublicUrlContext } from "@internal/analytics/events";
import {
  captureServerAnalyticsEvent,
  captureServerException,
  hashAnalyticsIdentifier,
} from "@internal/analytics/server";
import { envServer } from "@internal/core/env-server";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { redis } from "@internal/core/redis";
import { getClientIpFromHeaders } from "@internal/core/request-ip";
import { evaluateTurnstile, TURNSTILE_FAIL_CLOSED } from "@internal/core/turnstile";

const contactSchema = z.object({
  fullName: z.string().min(1, "fullName").max(200),
  workEmail: z.string().email("workEmail").max(320),
  domain: z.string().url().max(2048).optional().or(z.literal("")),
  locales: z.string().max(320).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
});

export async function submitContactMessage(locale: string, formData: FormData) {
  const windowMs = Number(envServer.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS);
  const maxPerWindow = Number(envServer.WEBSITE_CONTACT_MAX_PER_WINDOW);
  const ip = getClientIpFromHeaders(await headers());

  let ipLimit:
    | {
        allowed: boolean;
        resetAtMs: number;
      }
    | undefined;
  try {
    ipLimit = await rateLimitFixedWindow(redis, {
      key: `rl:v1:contact:create:ip:${encodeURIComponent(ip)}`,
      limit: maxPerWindow,
      windowMs,
    });
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Rate limit backend failed (contact create ip)",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        0,
      ),
    );
    captureServerException(error, {
      source: "contact_rate_limit",
      locale,
    });
    if (process.env.NODE_ENV === "production") {
      return redirect(`/${locale}/contact?error=server`);
    }
  }

  if (ipLimit && !ipLimit.allowed) {
    return redirect(`/${locale}/contact?error=rate_limited`);
  }

  // Bot gating (M12.3): fail-open — a Cloudflare outage must not drop a genuine
  // sales lead. A missing or rejected token is still blocked.
  const turnstile = await evaluateTurnstile({
    secretKey: envServer.TURNSTILE_SECRET_KEY,
    token: formData.get("cf-turnstile-response")?.toString() ?? null,
    remoteIp: ip,
    failClosed: TURNSTILE_FAIL_CLOSED.contact,
  });
  if (!turnstile.allowed) {
    return redirect(`/${locale}/contact?error=verification`);
  }

  const parsed = contactSchema.safeParse({
    fullName: formData.get("fullName")?.toString() ?? "",
    workEmail: formData.get("workEmail")?.toString() ?? "",
    domain: formData.get("domain")?.toString() ?? undefined,
    locales: formData.get("locales")?.toString() ?? undefined,
    message: formData.get("message")?.toString() ?? undefined,
  });

  if (!parsed.success) {
    return redirect(`/${locale}/contact?error=invalid`);
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("contact_messages").insert({
    locale,
    full_name: parsed.data.fullName,
    work_email: parsed.data.workEmail,
    domain: parsed.data.domain?.trim() || null,
    locales: parsed.data.locales?.trim() || null,
    message: parsed.data.message?.trim() || null,
  });

  const { sourceHost, sourcePath } = extractPublicUrlContext(parsed.data.domain);

  if (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to log contact message",
          error: error.message,
        },
        null,
        0,
      ),
    );
    captureServerAnalyticsEvent(ANALYTICS_EVENTS.contactMessageFailed, {
      locale,
      source_host: sourceHost,
      source_path: sourcePath,
      locales_present: Boolean(parsed.data.locales?.trim()),
      message_present: Boolean(parsed.data.message?.trim()),
      failure_kind: "database",
    });
    captureServerException(error, {
      source: "contact_insert",
      locale,
      source_host: sourceHost,
      source_path: sourcePath,
    });
    return redirect(`/${locale}/contact?error=server`);
  }

  captureServerAnalyticsEvent(
    ANALYTICS_EVENTS.contactMessageSubmitted,
    {
      locale,
      source_host: sourceHost,
      source_path: sourcePath,
      domain_present: Boolean(parsed.data.domain?.trim()),
      locales_present: Boolean(parsed.data.locales?.trim()),
      message_present: Boolean(parsed.data.message?.trim()),
    },
    {
      distinctId: hashAnalyticsIdentifier("contact_domain", parsed.data.domain),
    },
  );

  redirect(`/${locale}/contact?submitted=1`);
}
