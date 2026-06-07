import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createServiceRoleClient, fetchUserByEmail } from "@/lib/supabase/admin";
import { ANALYTICS_EVENTS, type AnalyticsProperties } from "@internal/analytics/events";
import {
  captureServerAnalyticsEvent,
  captureServerException,
  hashAnalyticsIdentifier,
} from "@internal/analytics/server";
import { getStripeClient, verifyStripeSignature } from "@internal/billing";
import { buildPublicErrorBody, buildRequestId, isProdEnv } from "@internal/core/public-errors";
import { SITE_ID } from "@modules/pricing";

export const runtime = "nodejs";

const webhookEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
const SUPABASE_USER_SCAN_PAGE_LIMIT = 25;

function maskStripeId(id: string) {
  const trimmed = id.trim();
  if (!trimmed) {
    return trimmed;
  }
  const suffix = trimmed.length > 6 ? trimmed.slice(-6) : trimmed;
  const underscore = trimmed.indexOf("_");
  if (underscore !== -1) {
    const prefix = trimmed.slice(0, underscore + 1);
    return `${prefix}***${suffix}`;
  }
  return `***${suffix}`;
}

function maskStripeIdOrNull(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  return maskStripeId(id);
}

type StripeBillingMetadata = {
  stripeCustomerId: string;
  lastStripeSubscriptionId: string | null;
  stripeSubscriptionStatus: Stripe.Subscription["status"] | null;
  stripeSubscriptionPriceId: string | null;
  stripeSubscriptionCurrentPeriodEnd: string | null;
  stripeSubscriptionCancelAtPeriodEnd: boolean | null;
};

function buildStripeBillingMetadata(
  customerId: string,
  subscription: Stripe.Subscription | null,
  subscriptionId: string | null = subscription?.id ?? null,
): StripeBillingMetadata {
  const periodEnd = subscription
    ? (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
    : undefined;
  return {
    stripeCustomerId: customerId,
    lastStripeSubscriptionId: subscriptionId,
    stripeSubscriptionStatus: subscription?.status ?? null,
    stripeSubscriptionPriceId: subscription?.items.data[0]?.price.id ?? null,
    stripeSubscriptionCurrentPeriodEnd:
      typeof periodEnd === "number" && periodEnd > 0
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    stripeSubscriptionCancelAtPeriodEnd: subscription?.cancel_at_period_end ?? null,
  };
}

async function resolveStripeSubscriptionFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<Stripe.Subscription | null> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!subscriptionId) {
    return null;
  }
  if (typeof session.subscription === "object" && session.subscription !== null) {
    return session.subscription;
  }
  return await getStripeClient().subscriptions.retrieve(subscriptionId);
}

async function resolveStripeCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await getStripeClient().customers.retrieve(customerId);
  if (isDeletedCustomer(customer)) {
    return null;
  }
  return customer.email ?? null;
}

type StripeBillingUserMetadata = Record<string, unknown> & {
  stripeCustomerId?: unknown;
};

function resolveStripeCustomerIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function userHasStripeCustomerId(userMetadata: unknown, customerId: string): boolean {
  if (userMetadata == null || typeof userMetadata !== "object" || Array.isArray(userMetadata)) {
    return false;
  }
  return (userMetadata as StripeBillingUserMetadata).stripeCustomerId === customerId;
}

async function findSupabaseUserByStripeCustomerId(customerId: string) {
  const supabase = createServiceRoleClient();
  const perPage = 100;
  let page = 1;

  while (page <= SUPABASE_USER_SCAN_PAGE_LIMIT) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error(
        JSON.stringify(
          {
            level: "error",
            message: "Failed to list Supabase users while resolving Stripe customer metadata",
            siteId: SITE_ID,
            customerId: maskStripeId(customerId),
            error: error.message,
          },
          null,
          0,
        ),
      );
      return null;
    }

    const match = data.users.find((user) =>
      userHasStripeCustomerId(user.user_metadata, customerId),
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  console.warn(
    JSON.stringify(
      {
        level: "warn",
        message: "Supabase user scan limit reached while resolving Stripe customer metadata",
        siteId: SITE_ID,
        customerId: maskStripeId(customerId),
        perPage,
        pageLimit: SUPABASE_USER_SCAN_PAGE_LIMIT,
      },
      null,
      0,
    ),
  );

  return null;
}

async function upsertStripeBillingMetadata({
  customerId,
  email,
  metadata,
  sessionLocale,
  allowCreate,
  logContext,
}: {
  customerId: string;
  email: string | null;
  metadata: StripeBillingMetadata;
  sessionLocale?: string | null;
  allowCreate: boolean;
  logContext: {
    sessionId?: string;
    customerId?: string;
    subscriptionId?: string;
  };
}) {
  const supabase = createServiceRoleClient();
  let existingUser: Awaited<ReturnType<typeof findSupabaseUserByStripeCustomerId>> | null = null;
  let resolvedEmail = email;

  try {
    existingUser = await findSupabaseUserByStripeCustomerId(customerId);
  } catch (lookupError) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to resolve Supabase user by Stripe customer id",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          error: lookupError instanceof Error ? lookupError.message : String(lookupError),
        },
        null,
        0,
      ),
    );
    return;
  }

  if (!existingUser && !resolvedEmail && !allowCreate) {
    try {
      resolvedEmail = await resolveStripeCustomerEmail(customerId);
    } catch (customerError) {
      console.warn(
        JSON.stringify(
          {
            level: "warn",
            message:
              "Failed to resolve Stripe customer email for subscription metadata recovery; continuing",
            siteId: SITE_ID,
            customerId: maskStripeId(customerId),
            ...logContext,
            subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
            error: customerError instanceof Error ? customerError.message : String(customerError),
          },
          null,
          0,
        ),
      );
    }
  }

  if (!existingUser && resolvedEmail) {
    try {
      existingUser = await fetchUserByEmail(resolvedEmail);
    } catch (fetchError) {
      console.error(
        JSON.stringify(
          {
            level: "error",
            message: "Failed to resolve Supabase user by email fallback",
            siteId: SITE_ID,
            customerId: maskStripeId(customerId),
            ...logContext,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          },
          null,
          0,
        ),
      );
      return;
    }
  }

  if (!existingUser && !resolvedEmail && allowCreate) {
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message: "Unable to create Supabase user from Stripe event without an email",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
        },
        null,
        0,
      ),
    );
    return;
  }

  if (!existingUser && !allowCreate) {
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message:
            "Unable to recover Supabase user from Stripe event without a matching Supabase user",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
        },
        null,
        0,
      ),
    );
    return;
  }

  const userMetadata = {
    ...(existingUser?.user_metadata ?? {}),
    stripeCustomerId: metadata.stripeCustomerId,
    lastStripeSubscriptionId: metadata.lastStripeSubscriptionId,
    stripeSubscriptionStatus: metadata.stripeSubscriptionStatus,
    stripeSubscriptionPriceId: metadata.stripeSubscriptionPriceId,
    stripeSubscriptionCurrentPeriodEnd: metadata.stripeSubscriptionCurrentPeriodEnd,
    stripeSubscriptionCancelAtPeriodEnd: metadata.stripeSubscriptionCancelAtPeriodEnd,
    ...(sessionLocale ? { locale: sessionLocale } : {}),
  };

  if (existingUser) {
    const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      user_metadata: userMetadata,
    });

    if (error) {
      console.error(
        JSON.stringify(
          {
            level: "error",
            message: "Failed to update Supabase user metadata after Stripe event",
            siteId: SITE_ID,
            customerId: maskStripeId(customerId),
            ...logContext,
            subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
            error: error.message,
          },
          null,
          0,
        ),
      );
    }
    return;
  }

  if (!resolvedEmail) {
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message: allowCreate
            ? "Unable to create Supabase user from Stripe event without an email"
            : "Unable to recover Supabase user from Stripe event without an email",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
        },
        null,
        0,
      ),
    );
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: resolvedEmail,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to create Supabase user from Stripe checkout",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeIdOrNull(metadata.lastStripeSubscriptionId),
          error: error.message,
        },
        null,
        0,
      ),
    );
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature header" }, { status: 400 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;

  try {
    event = verifyStripeSignature(rawBody, signature);
  } catch (error) {
    const requestId = buildRequestId();
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message: "Stripe signature verification failed",
          request_id: requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        0,
      ),
    );
    captureServerException(error, {
      source: "stripe_webhook_signature",
      error_name: error instanceof Error ? error.name : "unknown",
      route_area: "api",
      route_template: "/api/stripe/webhook",
    });
    const message = isProdEnv()
      ? "Invalid Stripe signature"
      : error instanceof Error
        ? error.message
        : "Unable to verify webhook";
    return NextResponse.json(buildPublicErrorBody({ error: message, requestId }), { status: 400 });
  }

  if (!webhookEvents.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const webhookDistinctId = hashAnalyticsIdentifier("stripe_event", event.id);
  const webhookAnalyticsProperties: AnalyticsProperties = {
    stripe_event_type: event.type,
  };

  captureServerAnalyticsEvent(ANALYTICS_EVENTS.stripeWebhookReceived, webhookAnalyticsProperties, {
    distinctId: webhookDistinctId,
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      webhookAnalyticsProperties.checkout_mode = session.mode;
      webhookAnalyticsProperties.locale = session.locale;
      webhookAnalyticsProperties.customer_present = Boolean(session.customer);
      webhookAnalyticsProperties.subscription_present = Boolean(sessionSubscriptionId);

      if (session.mode !== "subscription") {
        webhookAnalyticsProperties.outcome = "unexpected_checkout_mode";
        console.warn(
          JSON.stringify(
            {
              level: "warn",
              message: "Unexpected checkout session mode",
              mode: session.mode,
              siteId: SITE_ID,
              sessionId: maskStripeId(session.id),
            },
            null,
            0,
          ),
        );
        break;
      }

      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      let subscription: Stripe.Subscription | null = null;

      try {
        subscription = await resolveStripeSubscriptionFromCheckoutSession(session);
      } catch (subscriptionError) {
        console.warn(
          JSON.stringify(
            {
              level: "warn",
              message:
                "Failed to resolve Stripe subscription for completed checkout session; continuing with session data",
              siteId: SITE_ID,
              sessionId: maskStripeId(session.id),
              customerId: customerId ? maskStripeId(customerId) : null,
              error:
                subscriptionError instanceof Error
                  ? subscriptionError.message
                  : String(subscriptionError),
              subscriptionId: maskStripeIdOrNull(sessionSubscriptionId),
            },
            null,
            0,
          ),
        );
      }

      if (!customerId) {
        webhookAnalyticsProperties.outcome = "missing_customer";
        console.error(
          JSON.stringify(
            {
              level: "error",
              message: "Missing customer on completed checkout session",
              siteId: SITE_ID,
              sessionId: maskStripeId(session.id),
            },
            null,
            0,
          ),
        );
        break;
      }

      console.log(
        JSON.stringify(
          {
            level: "info",
            message: "Checkout session completed",
            siteId: SITE_ID,
            sessionId: maskStripeId(session.id),
            customerId: maskStripeId(customerId),
            subscriptionId: maskStripeIdOrNull(sessionSubscriptionId),
          },
          null,
          0,
        ),
      );

      webhookAnalyticsProperties.subscription_status = subscription?.status ?? null;

      let email = extractCustomerEmail(session);
      if (!email) {
        try {
          email = await resolveStripeCustomerEmail(customerId);
        } catch (customerError) {
          console.warn(
            JSON.stringify(
              {
                level: "warn",
                message:
                  "Failed to resolve Stripe customer email for completed checkout session; continuing",
                siteId: SITE_ID,
                sessionId: maskStripeId(session.id),
                customerId: maskStripeId(customerId),
                subscriptionId: maskStripeIdOrNull(sessionSubscriptionId),
                error:
                  customerError instanceof Error ? customerError.message : String(customerError),
              },
              null,
              0,
            ),
          );
          email = null;
        }
      }
      await upsertStripeBillingMetadata({
        customerId,
        email,
        metadata: buildStripeBillingMetadata(customerId, subscription, sessionSubscriptionId),
        sessionLocale: session.locale,
        allowCreate: true,
        logContext: {
          sessionId: maskStripeId(session.id),
          customerId: maskStripeId(customerId),
          subscriptionId: maskStripeIdOrNull(sessionSubscriptionId) ?? undefined,
        },
      });
      webhookAnalyticsProperties.outcome = "checkout_metadata_upsert_attempted";
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = resolveStripeCustomerIdFromSubscription(subscription);
      webhookAnalyticsProperties.customer_present = Boolean(customerId);
      webhookAnalyticsProperties.subscription_status = subscription.status;
      console.log(
        JSON.stringify(
          {
            level: "info",
            message: "Subscription lifecycle event",
            siteId: SITE_ID,
            subscriptionId: maskStripeId(subscription.id),
            status: subscription.status,
          },
          null,
          0,
        ),
      );
      if (!customerId) {
        webhookAnalyticsProperties.outcome = "missing_customer";
        console.warn(
          JSON.stringify(
            {
              level: "warn",
              message: "Subscription lifecycle event missing customer",
              siteId: SITE_ID,
              subscriptionId: maskStripeId(subscription.id),
              status: subscription.status,
            },
            null,
            0,
          ),
        );
        break;
      }

      await upsertStripeBillingMetadata({
        customerId,
        email: null,
        metadata: buildStripeBillingMetadata(customerId, subscription),
        allowCreate: false,
        logContext: {
          customerId: maskStripeId(customerId),
          subscriptionId: maskStripeId(subscription.id),
        },
      });
      webhookAnalyticsProperties.outcome = "subscription_metadata_upsert_attempted";
      break;
    }
    default:
      break;
  }

  captureServerAnalyticsEvent(ANALYTICS_EVENTS.stripeWebhookProcessed, webhookAnalyticsProperties, {
    distinctId: webhookDistinctId,
  });

  return NextResponse.json({ received: true });
}

function isDeletedCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): customer is Stripe.DeletedCustomer {
  return "deleted" in customer && customer.deleted === true;
}

function extractCustomerEmail(session: Stripe.Checkout.Session) {
  if (session.customer_details?.email) {
    return session.customer_details.email;
  }

  if (session.customer_email) {
    return session.customer_email;
  }

  if (
    session.customer != null &&
    typeof session.customer === "object" &&
    !isDeletedCustomer(session.customer)
  ) {
    return session.customer.email ?? null;
  }

  return null;
}
