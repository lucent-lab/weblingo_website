import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { createServiceRoleClient, fetchUserByEmail } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@internal/billing";
import { SITE_ID } from "@modules/pricing";

export const runtime = "nodejs";

const webhookEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

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
    const message = error instanceof Error ? error.message : "Unable to verify webhook";
    return NextResponse.json({ error: message }, { status: 400 });
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
              sessionId: session.id,
            },
            null,
            0,
          ),
        );
        break;
      }

      const customerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);

      if (!customerId || !subscriptionId) {
        console.error(
          JSON.stringify(
            {
              level: "error",
              message: "Missing customer or subscription on completed checkout session",
              siteId: SITE_ID,
              sessionId: session.id,
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
            sessionId: session.id,
            customerId,
            subscriptionId,
          },
          null,
          0,
        ),
      );

      await ensureSupabaseUser({
        session,
        customerId,
        subscriptionId,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        JSON.stringify(
          {
            level: "info",
            message: "Subscription lifecycle event",
            siteId: SITE_ID,
            subscriptionId: subscription.id,
            status: subscription.status,
          },
          null,
          0,
        ),
      );
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function ensureSupabaseUser({
  session,
  customerId,
  subscriptionId,
}: {
  session: Stripe.Checkout.Session;
  customerId: string;
  subscriptionId: string;
}) {
  const email = extractCustomerEmail(session);

  if (!email) {
    console.warn(
      JSON.stringify(
        {
          level: "warn",
          message: "Unable to create Supabase user without email",
          siteId: SITE_ID,
          sessionId: session.id,
          customerId,
          subscriptionId,
        },
        null,
        0,
      ),
    );
    return;
  }

  const supabase = createServiceRoleClient();
  let existingUser: Awaited<ReturnType<typeof fetchUserByEmail>> | null = null;

  try {
    existingUser = await fetchUserByEmail(email);
  } catch (fetchError) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to fetch Supabase user by email",
          siteId: SITE_ID,
          sessionId: session.id,
          customerId,
          subscriptionId,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        null,
        0,
      ),
    );
  }

  if (existingUser) {
    const metadata = {
      ...existingUser.user_metadata,
      stripeCustomerId: customerId,
      lastStripeSubscriptionId: subscriptionId,
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      user_metadata: metadata,
    });

    if (updateError) {
      console.error(
        JSON.stringify(
          {
            level: "error",
            message: "Failed to update Supabase user metadata after Stripe checkout",
            siteId: SITE_ID,
            sessionId: session.id,
            customerId,
            subscriptionId,
            error: updateError.message,
          },
          null,
          0,
        ),
      );
    }

    // TODO: Persist Stripe subscription status in a dedicated billing table when it exists.
    return;
  }

  const { error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      stripeCustomerId: customerId,
      lastStripeSubscriptionId: subscriptionId,
      locale: session.locale,
    },
  });

  if (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to create Supabase user from Stripe checkout",
          siteId: SITE_ID,
          sessionId: session.id,
          customerId,
          subscriptionId,
          error: error.message,
        },
        null,
        0,
      ),
    );
  }
  // TODO: Send onboarding email or analytics event after provisioning the account.
  // Consider generating a Supabase magic link or app-specific invite so the user can set a password.
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
    session.customer &&
    typeof session.customer === "object" &&
    !isDeletedCustomer(session.customer)
  ) {
    return session.customer.email ?? null;
  }

  return null;
}
