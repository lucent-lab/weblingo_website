import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { createServiceRoleClient, fetchUserByEmail } from "@/lib/supabase/admin";
import { getStripeClient, verifyStripeSignature } from "@internal/billing";
import { buildPublicErrorBody, buildRequestId, isProdEnv } from "@internal/core/public-errors";
import { SITE_ID } from "@modules/pricing";

export const runtime = "nodejs";

const webhookEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

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

type StripeBillingMetadata = {
  stripeCustomerId: string;
  lastStripeSubscriptionId: string;
  stripeSubscriptionStatus: Stripe.Subscription["status"];
  stripeSubscriptionPriceId: string | null;
  stripeSubscriptionCurrentPeriodEnd: string | null;
  stripeSubscriptionCancelAtPeriodEnd: boolean;
};

function buildStripeBillingMetadata(
  customerId: string,
  subscription: Stripe.Subscription,
): StripeBillingMetadata {
  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return {
    stripeCustomerId: customerId,
    lastStripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    stripeSubscriptionPriceId: subscription.items.data[0]?.price.id ?? null,
    stripeSubscriptionCurrentPeriodEnd:
      typeof periodEnd === "number" && periodEnd > 0
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    stripeSubscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
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

  while (true) {
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

  if (!existingUser && email) {
    try {
      existingUser = await fetchUserByEmail(email);
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

  if (!existingUser && !email && allowCreate) {
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message: "Unable to create Supabase user from Stripe event without an email",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeId(metadata.lastStripeSubscriptionId),
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
          message: "Unable to update Supabase user metadata without a matching Stripe customer id",
          siteId: SITE_ID,
          customerId: maskStripeId(customerId),
          ...logContext,
          subscriptionId: maskStripeId(metadata.lastStripeSubscriptionId),
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
            subscriptionId: maskStripeId(metadata.lastStripeSubscriptionId),
            error: error.message,
          },
          null,
          0,
        ),
      );
    }
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
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
          subscriptionId: maskStripeId(metadata.lastStripeSubscriptionId),
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== "subscription") {
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
        console.error(
          JSON.stringify(
            {
              level: "error",
              message: "Failed to resolve Stripe subscription for completed checkout session",
              siteId: SITE_ID,
              sessionId: maskStripeId(session.id),
              customerId: customerId ? maskStripeId(customerId) : null,
              error:
                subscriptionError instanceof Error
                  ? subscriptionError.message
                  : String(subscriptionError),
            },
            null,
            0,
          ),
        );
        break;
      }

      if (!customerId || !subscription) {
        console.error(
          JSON.stringify(
            {
              level: "error",
              message: "Missing customer or subscription on completed checkout session",
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
            subscriptionId: maskStripeId(subscription.id),
          },
          null,
          0,
        ),
      );

      let email = extractCustomerEmail(session);
      if (!email) {
        try {
          email = await resolveStripeCustomerEmail(customerId);
        } catch (customerError) {
          console.error(
            JSON.stringify(
              {
                level: "error",
                message: "Failed to resolve Stripe customer email for completed checkout session",
                siteId: SITE_ID,
                sessionId: maskStripeId(session.id),
                customerId: maskStripeId(customerId),
                subscriptionId: maskStripeId(subscription.id),
                error:
                  customerError instanceof Error ? customerError.message : String(customerError),
              },
              null,
              0,
            ),
          );
          break;
        }
      }
      if (!email) {
        console.warn(
          JSON.stringify(
            {
              level: "warn",
              message: "Unable to update Supabase user metadata after checkout without email",
              siteId: SITE_ID,
              sessionId: maskStripeId(session.id),
              customerId: maskStripeId(customerId),
              subscriptionId: maskStripeId(subscription.id),
            },
            null,
            0,
          ),
        );
        break;
      }

      await upsertStripeBillingMetadata({
        customerId,
        email,
        metadata: buildStripeBillingMetadata(customerId, subscription),
        sessionLocale: session.locale,
        allowCreate: true,
        logContext: {
          sessionId: maskStripeId(session.id),
          customerId: maskStripeId(customerId),
          subscriptionId: maskStripeId(subscription.id),
        },
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = resolveStripeCustomerIdFromSubscription(subscription);
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

      let email: string | null = null;
      try {
        email = await resolveStripeCustomerEmail(customerId);
      } catch (customerError) {
        console.warn(
          JSON.stringify(
            {
              level: "warn",
              message: "Stripe customer email lookup failed for lifecycle event; continuing",
              siteId: SITE_ID,
              customerId: maskStripeId(customerId),
              subscriptionId: maskStripeId(subscription.id),
              status: subscription.status,
              error: customerError instanceof Error ? customerError.message : String(customerError),
            },
            null,
            0,
          ),
        );
      }

      await upsertStripeBillingMetadata({
        customerId,
        email,
        metadata: buildStripeBillingMetadata(customerId, subscription),
        allowCreate: false,
        logContext: {
          customerId: maskStripeId(customerId),
          subscriptionId: maskStripeId(subscription.id),
        },
      });
      break;
    }
    default:
      break;
  }

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
