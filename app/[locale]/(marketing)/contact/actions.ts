"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { envServer } from "@internal/core/env-server";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { redis } from "@internal/core/redis";
import { getClientIpFromHeaders } from "@internal/core/request-ip";

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
    if (process.env.NODE_ENV === "production") {
      return redirect(`/${locale}/contact?error=server`);
    }
  }

  if (ipLimit && !ipLimit.allowed) {
    return redirect(`/${locale}/contact?error=rate_limited`);
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
    return redirect(`/${locale}/contact?error=server`);
  }

  redirect(`/${locale}/contact?submitted=1`);
}
