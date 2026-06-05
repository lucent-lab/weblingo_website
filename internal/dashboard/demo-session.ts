import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { redis } from "@/internal/core/redis";

import { DASHBOARD_DEMO_SESSION_COOKIE } from "./demo-session-constants";

const DASHBOARD_DEMO_SESSION_KEY_PREFIX = "dashboard:demo-session:v1";
const DASHBOARD_DEMO_SESSION_ID_BYTES = 32;

const planTypeSchema = z.enum(["free", "starter", "pro", "agency"]);
const planStatusSchema = z.enum(["active", "past_due", "cancelled"]);

const demoClaimPayloadSchema = z
  .object({
    token: z.string().min(1),
    expiresAt: z.string().min(1),
    entitlements: z
      .object({
        planType: planTypeSchema,
        planStatus: planStatusSchema,
      })
      .strict(),
    actorAccountId: z.string().min(1),
    subjectAccountId: z.string().min(1),
    prospectShowcaseId: z.string().min(1),
    prospectShowcaseRef: z.string().min(1),
    siteId: z.string().min(1),
    demo: z.literal(true),
    conversionToken: z.string().min(1),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (payload.actorAccountId !== payload.subjectAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Demo dashboard claims must be single-account scoped.",
        path: ["subjectAccountId"],
      });
    }
    if (!Number.isFinite(Date.parse(payload.expiresAt))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Demo dashboard claim expiry is invalid.",
        path: ["expiresAt"],
      });
    }
  });

const storedDemoSessionSchema = demoClaimPayloadSchema.extend({
  createdAt: z.string().min(1),
});

export type DashboardDemoClaimPayload = z.infer<typeof demoClaimPayloadSchema>;
export type DashboardDemoSession = z.infer<typeof storedDemoSessionSchema>;

export type DashboardDemoSessionCookie = {
  id: string;
  maxAgeSeconds: number;
};

export function parseDashboardDemoClaimPayload(value: unknown): DashboardDemoClaimPayload | null {
  const parsed = demoClaimPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function buildDashboardDemoRedirectUrl(siteId: string): string {
  return `/dashboard/sites/${encodeURIComponent(siteId)}`;
}

export function getDashboardDemoSessionSecondsUntilExpiry(expiresAt: string): number {
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) {
    return 0;
  }
  return Math.floor((timestamp - Date.now()) / 1000);
}

export function isDashboardDemoSessionFresh(expiresAt: string): boolean {
  return getDashboardDemoSessionSecondsUntilExpiry(expiresAt) >= 1;
}

export function buildDashboardDemoSessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard",
    maxAge: maxAgeSeconds,
  };
}

export async function createDashboardDemoSession(
  payload: DashboardDemoClaimPayload,
): Promise<DashboardDemoSessionCookie> {
  const maxAgeSeconds = getDashboardDemoSessionSecondsUntilExpiry(payload.expiresAt);
  if (maxAgeSeconds < 1) {
    throw new Error("Demo dashboard claim is expired.");
  }

  const id = randomBytes(DASHBOARD_DEMO_SESSION_ID_BYTES).toString("base64url");
  const session: DashboardDemoSession = {
    ...payload,
    createdAt: new Date().toISOString(),
  };
  await redis.set(getDashboardDemoSessionKey(id), session, { ex: maxAgeSeconds });
  return { id, maxAgeSeconds };
}

export async function readDashboardDemoSession(): Promise<DashboardDemoSession | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(DASHBOARD_DEMO_SESSION_COOKIE)?.value.trim();
  if (!sessionId) {
    return null;
  }

  const stored = await redis.get<unknown>(getDashboardDemoSessionKey(sessionId));
  const parsed = storedDemoSessionSchema.safeParse(stored);
  if (!parsed.success) {
    return null;
  }
  if (!isDashboardDemoSessionFresh(parsed.data.expiresAt)) {
    return null;
  }
  return parsed.data;
}

export async function clearDashboardDemoSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_DEMO_SESSION_COOKIE, "", buildDashboardDemoSessionCookieOptions(0));
}

function getDashboardDemoSessionKey(sessionId: string): string {
  const digest = createHash("sha256").update(sessionId).digest("hex");
  return `${DASHBOARD_DEMO_SESSION_KEY_PREFIX}:${digest}`;
}
