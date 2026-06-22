import "server-only";

import { z } from "zod";

import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Cloudflare Turnstile server-side verification (M12.3 bot gating).
 *
 * This module is the single authority for deciding whether an unauthenticated,
 * high-abuse request (preview create, waitlist signup, contact message) is
 * allowed to proceed. It is intentionally pure and dependency-injectable so the
 * security logic is unit-testable without network access or env parsing.
 *
 * Enforcement is opt-in: when no secret key is configured the feature is
 * disabled and every request is allowed (keeps local dev / CI / tests green
 * without Cloudflare credentials, mirroring the existing TRY_NOW_TOKEN gate).
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 5_000;

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileFailureReason = "missing-token" | "rejected" | "unavailable";

export type TurnstileVerifyOutcome =
  | { ok: true }
  | { ok: false; reason: TurnstileFailureReason; errorCodes?: string[] };

export type VerifyTurnstileTokenOptions = {
  secretKey: string;
  token: string | null | undefined;
  /** Visitor IP forwarded to Cloudflare as `remoteip` (skipped when "unknown"). */
  remoteIp?: string;
  timeoutMs?: number;
};

/**
 * Verify a Turnstile token against Cloudflare's siteverify API.
 *
 * Returns a structured outcome rather than throwing so callers can apply
 * per-endpoint fail-open / fail-closed policy deterministically.
 */
export async function verifyTurnstileToken(
  options: VerifyTurnstileTokenOptions,
): Promise<TurnstileVerifyOutcome> {
  const token = options.token?.trim();
  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams();
  body.set("secret", options.secretKey);
  body.set("response", token);
  if (options.remoteIp && options.remoteIp !== "unknown") {
    body.set("remoteip", options.remoteIp);
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      SITEVERIFY_URL,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      },
      { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
    );
  } catch {
    // Network error or timeout reaching Cloudflare → treat as unavailable so
    // callers decide fail-open vs fail-closed.
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const parsed = siteverifyResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, reason: "unavailable" };
  }

  if (parsed.data.success) {
    return { ok: true };
  }

  return { ok: false, reason: "rejected", errorCodes: parsed.data["error-codes"] };
}

export type TurnstileDecision =
  | { allowed: true; enforced: boolean }
  | { allowed: false; enforced: true; status: number; reason: TurnstileFailureReason };

export type EvaluateTurnstileOptions = {
  /** envServer.TURNSTILE_SECRET_KEY — when undefined/empty the gate is disabled. */
  secretKey: string | undefined;
  token: string | null | undefined;
  remoteIp?: string;
  /**
   * Fail-closed (true): a Cloudflare outage blocks the request (protect the
   * expensive/money path, e.g. preview create).
   * Fail-open (false): a Cloudflare outage lets the request through (don't lose
   * a lead, e.g. waitlist/contact). A *missing* or *rejected* token is ALWAYS
   * blocked regardless of this flag — that is the whole point of the gate.
   */
  failClosed: boolean;
  timeoutMs?: number;
};

/**
 * Apply Turnstile policy for a single endpoint. Call sites map the decision to
 * their own response shape (JSON error vs redirect).
 */
export async function evaluateTurnstile(
  options: EvaluateTurnstileOptions,
): Promise<TurnstileDecision> {
  if (!options.secretKey) {
    return { allowed: true, enforced: false };
  }

  const outcome = await verifyTurnstileToken({
    secretKey: options.secretKey,
    token: options.token,
    remoteIp: options.remoteIp,
    timeoutMs: options.timeoutMs,
  });

  if (outcome.ok) {
    return { allowed: true, enforced: true };
  }

  if (outcome.reason === "unavailable" && !options.failClosed) {
    return { allowed: true, enforced: true };
  }

  const status = outcome.reason === "unavailable" ? 503 : 403;
  return { allowed: false, enforced: true, status, reason: outcome.reason };
}

/**
 * Per-endpoint fail-open / fail-closed policy, centralized for clarity.
 * - preview (prospect-showcases): protect LLM/compute spend → fail-closed.
 * - waitlist / contact: don't drop a real lead on a Cloudflare hiccup → fail-open.
 * (Missing/rejected tokens are blocked in all cases.)
 */
export const TURNSTILE_FAIL_CLOSED = {
  preview: true,
  waitlist: false,
  contact: false,
} as const;
