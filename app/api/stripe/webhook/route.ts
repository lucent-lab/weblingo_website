import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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
      console.log(
        JSON.stringify(
          {
            level: "info",
            message: "Checkout session completed",
            siteId: SITE_ID,
            sessionId: session.id,
            customerId: session.customer,
            subscriptionId: session.subscription,
          },
          null,
          0,
        ),
      );
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
