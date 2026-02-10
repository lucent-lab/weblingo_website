import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  readJsonBodyLimited,
  RequestBodyInvalidJsonError,
  RequestBodyTooLargeError,
} from "@internal/core/body";
import { envServer } from "@internal/core/env-server";
import { rateLimitFixedWindow } from "@internal/core/rate-limit";
import { redis } from "@internal/core/redis";
import { getClientIp } from "@internal/core/request-ip";

const payloadSchema = z.object({
  email: z.string().email().max(320),
  siteUrl: z.string().url().max(2048).optional(),
});

// Ensure you create a table named `launch_waitlist_signups` with a unique constraint on `email`.
const TABLE_NAME = "launch_waitlist_signups" satisfies keyof Database["public"]["Tables"];
type WaitlistInsert = Database["public"]["Tables"][typeof TABLE_NAME]["Insert"];
type WaitlistRow = Pick<
  Database["public"]["Tables"][typeof TABLE_NAME]["Row"],
  "id" | "created_at"
>;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const windowMs = Number(envServer.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS);
  const maxPerWindow = Number(envServer.WEBSITE_WAITLIST_MAX_PER_WINDOW);
  const maxBodyBytes = Number(envServer.WEBSITE_WAITLIST_MAX_BODY_BYTES);

  const ip = getClientIp(request);
  try {
    const ipLimit = await rateLimitFixedWindow(redis, {
      key: `rl:v1:waitlist:create:ip:${encodeURIComponent(ip)}`,
      limit: maxPerWindow,
      windowMs,
    });
    if (!ipLimit.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAtMs - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Rate limit backend failed (waitlist create ip)",
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        0,
      ),
    );
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
  }

  let json: unknown;
  try {
    json = await readJsonBodyLimited(request, { maxBytes: maxBodyBytes });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    if (error instanceof RequestBodyInvalidJsonError) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const base =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const parsed = payloadSchema.safeParse({
    email: typeof base.email === "string" ? base.email.trim() : base.email,
    siteUrl:
      typeof base.siteUrl === "string" && base.siteUrl.trim().length > 0
        ? base.siteUrl.trim()
        : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const waitlistRow: WaitlistInsert = {
    email: parsed.data.email,
    site_url: parsed.data.siteUrl ?? null,
    user_agent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(waitlistRow, {
      onConflict: "email",
      ignoreDuplicates: false,
    })
    .select("id, created_at")
    .single<WaitlistRow>();

  if (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to upsert waitlist signup",
          error: error.message,
        },
        null,
        0,
      ),
    );
    return NextResponse.json({ error: "Unable to save signup right now" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, signupId: data?.id, createdAt: data?.created_at });
}
