import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ANALYTICS_EVENTS } from "@internal/analytics/events";
import {
  captureServerAnalyticsEvent,
  captureServerException,
  hashAnalyticsIdentifier,
} from "@internal/analytics/server";
import { createCheckoutSession } from "@internal/billing";
import { buildPublicErrorBody, buildRequestId, isProdEnv } from "@internal/core/public-errors";
import { envServer } from "@internal/core/env-server";
import { i18nConfig, normalizeLocale } from "@internal/i18n";

const bodySchema = z.object({
  planId: z.string().min(1),
  cadence: z.enum(["monthly", "yearly"]),
  email: z.string().email().optional(),
  locale: z.enum(i18nConfig.locales),
});

export async function POST(request: NextRequest) {
  if (envServer.PUBLIC_PORTAL_MODE !== "enabled") {
    return NextResponse.json({ error: "Checkout disabled" }, { status: 403 });
  }
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parseResult = bodySchema.safeParse(payload);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { planId, cadence, email, locale } = parseResult.data;
  const normalizedLocale = normalizeLocale(locale);
  const appUrl = envServer.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  try {
    const session = await createCheckoutSession({
      planId,
      cadence,
      email,
      successUrl: `${appUrl}/${normalizedLocale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/${normalizedLocale}/checkout/cancel`,
    });

    await captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.checkoutSessionCreateSucceeded,
      {
        plan_id: planId,
        cadence,
        locale: normalizedLocale,
        email_present: Boolean(email),
        checkout_url_present: Boolean(session.url),
      },
      {
        distinctId: hashAnalyticsIdentifier("stripe_session", session.id),
      },
    );

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    const clientErrorPatterns = [
      "Unknown pricing plan",
      "Missing monthly price",
      "Missing yearly price",
      "Invalid",
    ];
    const isClientError =
      error instanceof Error &&
      clientErrorPatterns.some((pattern) => error.message.includes(pattern));
    const status = isClientError ? 400 : 500;

    await captureServerAnalyticsEvent(
      ANALYTICS_EVENTS.checkoutSessionCreateFailed,
      {
        plan_id: planId,
        cadence,
        locale: normalizedLocale,
        email_present: Boolean(email),
        failure_kind: isClientError ? "client" : "server",
        failure_status: status,
        error_name: error instanceof Error ? error.name : "unknown",
      },
      {
        distinctId: hashAnalyticsIdentifier(
          "checkout_request",
          `${planId}:${cadence}:${normalizedLocale}`,
        ),
      },
    );

    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }

    await captureServerException(
      error,
      {
        source: "stripe_create_checkout_session",
        plan_id: planId,
        cadence,
        locale: normalizedLocale,
      },
      {
        distinctId: hashAnalyticsIdentifier(
          "checkout_request",
          `${planId}:${cadence}:${normalizedLocale}`,
        ),
      },
    );

    const requestId = buildRequestId();
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to create checkout session",
          request_id: requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        0,
      ),
    );

    if (isProdEnv()) {
      return NextResponse.json(
        buildPublicErrorBody({ error: "Unable to start checkout right now", requestId }),
        { status },
      );
    }

    return NextResponse.json(buildPublicErrorBody({ error: message, requestId }), { status });
  }
}
