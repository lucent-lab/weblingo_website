import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

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
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
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
